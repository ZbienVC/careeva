import Navbar from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar showDashboard={true} />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
