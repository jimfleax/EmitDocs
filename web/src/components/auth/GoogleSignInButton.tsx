import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { authClient } from "../../lib/auth-client";
import { cn } from "@/lib/utils";

interface GoogleSignInButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  callbackURL?: string;
}

export function GoogleSignInButton({
  className,
  callbackURL,
  ...props
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      const targetCallbackURL =
        callbackURL ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/app`
          : "/app");
      await authClient.signIn.social({
        provider: "google",
        callbackURL: targetCallbackURL,
      });
    } catch (err) {
      console.error("Sign-in error:", err);
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={isLoading}
      className={cn(
        "w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all duration-150 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none",
        className,
      )}
      {...props}
    >
      <FcGoogle className="w-5 h-5 flex-none text-xl" />
      <span>
        {isLoading ? "Connecting to Google..." : "Continue with Google"}
      </span>
    </button>
  );
}

export default GoogleSignInButton;
