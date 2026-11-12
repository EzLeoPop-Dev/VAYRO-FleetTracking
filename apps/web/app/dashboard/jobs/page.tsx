import { AdminPage, directorySurface } from "../admin-directory";

export const metadata = { title: "งานขนส่ง | VAYRO" };

export default function JobsPage() {
  return (
    <AdminPage title="งานขนส่ง" description="จุดรับ–ส่ง รถ และคนขับที่ได้รับมอบหมายในแต่ละงาน">
      <section className={`${directorySurface} p-5 sm:p-7`} aria-labelledby="jobs-empty">
        <h2 id="jobs-empty" className="font-semibold">ยังไม่มีงานขนส่ง</h2>
        <p className="mt-2 text-sm text-[color:var(--fleet-muted)]">ชุดข้อมูลจำลองปัจจุบันมีข้อมูลรถและคนขับ</p>
      </section>
    </AdminPage>
  );
}
