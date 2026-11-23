import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 text-[#2A2118]">
      <section className="w-full max-w-md rounded-2xl border border-[#E7DED1] bg-white p-7 text-center shadow-xl">
        <h1 className="text-lg font-semibold text-[#2A2118]">Could not confirm your account</h1>
        <p className="mt-2 text-sm leading-6 text-[#5D4037]">The confirmation link may have expired. Request a new one or sign in if your email is already confirmed.</p>
        <Link href="/login" className="mt-5 inline-flex rounded-lg bg-[#6E2C24] px-4 py-2 text-sm font-medium text-white hover:bg-[#8A3B2A]">Back to sign in</Link>
      </section>
    </main>
  )
}
