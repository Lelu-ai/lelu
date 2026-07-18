import { FaGoogle, FaGithub } from "react-icons/fa6";

const buttonCls =
  "flex items-center justify-center gap-2.5 w-full h-11 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#13151C] text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#181A22] transition-colors";

// Full-page redirects (plain <a>, no client JS) into /api/auth/{provider} —
// the OAuth handshake itself lives entirely server-side in those routes.
export function OAuthButtons({ next }: { next?: string }) {
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="space-y-2.5">
      <a href={`/api/auth/google${suffix}`} className={buttonCls}>
        <FaGoogle className="h-4 w-4" />
        Continue with Google
      </a>
      <a href={`/api/auth/github${suffix}`} className={buttonCls}>
        <FaGithub className="h-4 w-4" />
        Continue with GitHub
      </a>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-[#E7E5E4] dark:bg-[#20222B]" />
        <span className="text-[12px] text-[#A3A3A3]">or</span>
        <div className="h-px flex-1 bg-[#E7E5E4] dark:bg-[#20222B]" />
      </div>
    </div>
  );
}
