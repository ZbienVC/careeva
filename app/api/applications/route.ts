import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { appliedAt: 'desc' },
    });

    const formatted = applications.map((app) => ({
      id: app.id,
      company: app.company,
      role: app.role,
      status: app.status,
      dateApplied: app.dateApplied || app.appliedAt.toISOString().split('T')[0],
      notes: app.notes || '',
      url: app.url || '',
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to fetch applications:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { company, role, status, dateApplied, notes, url } = body;

    if (!company || !role) {
      return NextResponse.json({ error: 'Company and role are required' }, { status: 400 });
    }

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company,
        role,
        status: status || 'applied',
        dateApplied,
        appliedAt: dateApplied ? new Date(dateApplied) : new Date(),
        notes,
        url,
      },
    });

    return NextResponse.json({
      id: application.id,
      company: application.company,
      role: application.role,
      status: application.status,
      dateApplied: application.dateApplied || application.appliedAt.toISOString().split('T')[0],
      notes: application.notes || '',
      url: application.url || '',
    });
  } catch (error) {
    console.error('Failed to create application:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, company, role, status, dateApplied, notes, url } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const app = await prisma.application.findFirst({ where: { id, userId: user.id } });
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        company: company || app.company,
        role: role || app.role,
        status: status || app.status,
        dateApplied: dateApplied || app.dateApplied,
        notes: notes !== undefined ? notes : app.notes,
        url: url !== undefined ? url : app.url,
        appliedAt: dateApplied ? new Date(dateApplied) : app.appliedAt,
      },
    });

    return NextResponse.json({
      id: updated.id,
      company: updated.company,
      role: updated.role,
      status: updated.status,
      dateApplied: updated.dateApplied || updated.appliedAt.toISOString().split('T')[0],
      notes: updated.notes || '',
      url: updated.url || '',
    });
  } catch (error) {
    console.error('Failed to update application:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const app = await prisma.application.findFirst({ where: { id, userId: user.id } });
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    await prisma.application.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete application:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
