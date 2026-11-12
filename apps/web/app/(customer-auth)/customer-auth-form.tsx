"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const field =
  "min-h-[3.3rem] w-full rounded-[var(--fleet-radius)] soft-inset border border-[var(--fleet-line)] bg-[var(--fleet-quiet)] px-4 py-3 text-base text-[color:var(--fleet-text)] outline-none placeholder:text-[color:var(--fleet-muted)] hover:border-[var(--fleet-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fleet-focus)]";

export default function CustomerAuthForm({
  mode,
}: {
  mode: "login" | "register";
}) {
  const isLogin = mode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(
      isLogin
        ? "ยังเข้าสู่ระบบไม่ได้ เพราะระบบยืนยันตัวตนยังไม่เชื่อมต่อ"
        : "ยังไม่ได้ส่งข้อมูล เพราะระบบรับคำขอยังไม่เปิดใช้งาน",
    );
  }

  return (
    <div className="motion-safe:animate-[panel-enter_420ms_ease-out_both] mx-auto w-full max-w-[26rem] max-[720px]:max-w-[30rem]">
      <p className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-[.13em] text-[color:var(--fleet-muted)]">
        <span className="size-1.5 rounded-full bg-[var(--fleet-signal)]" />{" "}
        WORKSPACE ACCESS
      </p>
      <h1
        id="auth-title"
        className="m-0 text-[clamp(1.85rem,3vw,2.55rem)] font-bold leading-[1.25] tracking-[-.035em] text-[color:var(--fleet-text)]"
      >
        {isLogin ? "ยินดีต้อนรับกลับ" : "เริ่มต้นใช้งาน VAYRO"}
      </h1>
      <p className="mb-8 mt-3 text-base leading-relaxed text-[color:var(--fleet-muted)] max-[390px]:mb-6">
        {isLogin
          ? "เข้าสู่ระบบเพื่อดูรถและงานขนส่งของบริษัท"
          : "ส่งข้อมูลบริษัทและผู้ประสานงานเพื่อขอเปิด Workspace"}
      </p>
      <form
        className="grid gap-4"
        method="post"
        onSubmit={handleSubmit}
        onChange={() => {
          if (status) setStatus("");
        }}
        aria-describedby="auth-preview"
      >
        {!isLogin && (
          <>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-[color:var(--fleet-text)]"
                htmlFor="company"
              >
                ชื่อบริษัท
              </label>
              <input
                className={field}
                id="company"
                autoComplete="organization"
                required
                maxLength={150}
                pattern={String.raw`.*\S.*`}
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-[color:var(--fleet-text)]"
                htmlFor="contact"
              >
                ชื่อผู้ประสานงาน
              </label>
              <input
                className={field}
                id="contact"
                autoComplete="name"
                required
                maxLength={150}
                pattern={String.raw`.*\S.*`}
              />
            </div>
          </>
        )}
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-[color:var(--fleet-text)]"
            htmlFor="email"
          >
            อีเมลบริษัท
          </label>
          <input
            className={field}
            id="email"
            type="email"
            autoComplete={isLogin ? "username" : "email"}
            placeholder="you@company.com"
            required
            maxLength={254}
          />
        </div>
        {isLogin && (
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-[color:var(--fleet-text)]"
              htmlFor="password"
            >
              รหัสผ่าน
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                className={field}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                className="min-h-[3.3rem] min-w-[5.4rem] rounded-[var(--fleet-radius)] soft-control border border-[var(--fleet-line)] bg-[var(--fleet-surface)] px-3 text-xs text-[color:var(--fleet-muted)] hover:bg-[var(--fleet-selected)] hover:text-[color:var(--fleet-accent)] active:soft-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fleet-focus)]"
                type="button"
                aria-controls="password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              </button>
            </div>
          </div>
        )}
        <button
          className="mt-1 flex min-h-[3.35rem] items-center justify-between rounded-[var(--fleet-radius)] soft-control bg-[var(--fleet-signal)] px-5 text-base font-semibold text-[color:var(--fleet-on-signal)] motion-safe:transition-transform motion-safe:duration-200 hover:bg-[var(--fleet-signal-hover)] active:soft-inset motion-safe:active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--fleet-focus)]"
          type="submit"
        >
          <span>{isLogin ? "เข้าสู่ Workspace" : "ส่งคำขอเปิด Workspace"}</span>
          <svg
            aria-hidden="true"
            className="size-5 shrink-0"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 15 15 5m-7 0h7v7" />
          </svg>
        </button>
        <p
          id="auth-preview"
          className="m-0 flex items-center gap-2 text-xs leading-relaxed text-[color:var(--fleet-muted)]"
        >
          <span
            className="grid size-4 place-items-center rounded-full border border-[var(--fleet-line)] text-[10px]"
            aria-hidden="true"
          >
            i
          </span>{" "}
          หน้าทดลอง · ระบบยืนยันตัวตนยังไม่เปิดใช้งาน
        </p>
        <div
          className="text-sm leading-relaxed text-[color:var(--fleet-accent)] empty:hidden"
          role="status"
        >
          {status}
        </div>
      </form>
      <p className="mt-6 border-t border-[var(--fleet-line)] pt-5 text-[13px] leading-relaxed text-[color:var(--fleet-muted)]">
        {isLogin ? "ยังไม่มี Workspace ของบริษัท?" : "มี Workspace อยู่แล้ว?"}{" "}
        <Link
          className="font-bold text-[color:var(--fleet-accent)] underline decoration-current underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--fleet-focus)]"
          href={isLogin ? "/register" : "/login"}
        >
          {isLogin ? "ส่งคำขอเปิดใช้งาน" : "เข้าสู่ระบบ"}
        </Link>
      </p>
    </div>
  );
}
