import Navbar from '@/components/Navbar';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar showAuth={true} />
      <main className="min-h-screen bg-[#0d1117]">{children}</main>
    </>
  );
}
