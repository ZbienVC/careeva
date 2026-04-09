import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseResume } from '@/lib/resume-parser';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Auth optional — parse for everyone, save to DB only when signed in
    const user = await getCurrentUserFromRequest(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Accept by extension when MIME type is blank
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Please upload a PDF, DOCX, or TXT file' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    const filename = 'resume-' + Date.now() + '-' + file.name;
    const filepath = join(uploadsDir, filename);
    const bytes = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(bytes));

    const parsed = await parseResume(filepath);

    // Save to DB only when authenticated
    if (user?.id) {
      // 1. Update flat UserProfile (backward compat for scoring)
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          skills: parsed.skills,
          roles: parsed.roles,
          industries: parsed.industries,
          yearsExperience: parsed.yearsExperience,
          education: parsed.education,
          technologies: parsed.technologies,
          resumeUrl: '/uploads/' + filename,
        },
        update: {
          skills: parsed.skills,
          roles: parsed.roles,
          industries: parsed.industries,
          yearsExperience: parsed.yearsExperience,
          education: parsed.education,
          technologies: parsed.technologies,
          resumeUrl: '/uploads/' + filename,
        },
      });

      // 2. Save Resume record
      await prisma.resume.create({
        data: {
          userId: user.id,
          name: 'Uploaded ' + new Date().toLocaleDateString(),
          fileUrl: '/uploads/' + filename,
          fileType: ext === '.pdf' ? 'pdf' : ext === '.txt' ? 'txt' : 'docx',
          isBase: true,
          rawText: parsed.rawText || '',
        },
      });

      // 3. Auto-create WorkHistory records from parsed positions
      if (parsed.workHistory && parsed.workHistory.length > 0) {
        for (const wh of parsed.workHistory) {
          if (!wh.company || !wh.title) continue;
          // Skip if this company+title already exists
          const exists = await prisma.workHistory.findFirst({
            where: { userId: user.id, company: wh.company, title: wh.title },
          });
          if (exists) continue;

          await prisma.workHistory.create({
            data: {
              userId: user.id,
              company: wh.company,
              title: wh.title,
              startDate: wh.startDate ? new Date(wh.startDate + '-01') : null,
              endDate: wh.endDate ? new Date(wh.endDate + '-01') : null,
              isCurrent: wh.isCurrent || false,
              summary: wh.summary || '',
              skills: wh.skills || [],
              technologies: wh.technologies || [],
            },
          });
        }
      }

      // 4. Auto-create EducationEntry records
      if (parsed.educationEntries && parsed.educationEntries.length > 0) {
        for (const edu of parsed.educationEntries) {
          if (!edu.institution) continue;
          const exists = await prisma.educationEntry.findFirst({
            where: { userId: user.id, institution: edu.institution },
          });
          if (exists) continue;

          await prisma.educationEntry.create({
            data: {
              userId: user.id,
              institution: edu.institution,
              degree: edu.degree || '',
              fieldOfStudy: edu.fieldOfStudy || '',
              endDate: edu.endDate ? new Date(edu.endDate + '-06-01') : null,
              isCurrent: false,
            },
          });
        }
      }

      // 5. Bulk add skills (skip duplicates)
      const allSkills = [...new Set([...parsed.skills, ...parsed.technologies])];
      if (allSkills.length > 0) {
        const existing = await prisma.skill.findMany({
          where: { userId: user.id },
          select: { name: true },
        });
        const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
        const toAdd = allSkills.filter(s => !existingNames.has(s.toLowerCase())).slice(0, 60);
        if (toAdd.length > 0) {
          await prisma.skill.createMany({
            data: toAdd.map(name => ({ userId: user.id!, name, category: 'technical' })),
            skipDuplicates: true,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: parsed,
      resume: {
        rawText: parsed.rawText || '',
        skills: parsed.skills,
        technologies: parsed.technologies,
        roles: parsed.roles,
        yearsExperience: parsed.yearsExperience,
        workHistory: parsed.workHistory || [],
        educationEntries: parsed.educationEntries || [],
        education: parsed.education || [],
      },
      message: parsed.skills.length + ' skills, ' +
        (parsed.workHistory?.length || 0) + ' positions, ' +
        (parsed.educationEntries?.length || 0) + ' education entries extracted',
      skillsAdded: parsed.skills.length,
      positionsFound: parsed.workHistory?.length || 0,
      educationFound: parsed.educationEntries?.length || 0,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
