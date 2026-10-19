/**
 * @file GoogleSignInButton.tsx
 * @description Google OAuth single sign-on trigger button with loading feedback.
 * @architecture Dispatches Better Auth social authentication flow with configurable callback redirects.
 * @agent_note Initiates client-side OAuth flow with customizable success and failure callback URLs.
 */

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { authClient } from "../../lib/auth-client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface GoogleSignInButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  callbackURL?: string;
}

/**
 * @component GoogleSignInButton
 * @description Triggers Google OAuth sign-in flow via Better Auth client.
 * @param {GoogleSignInButtonProps} props - Button HTML properties and optional callbackURL.
 * @state Manages pending authentication connection state.
 * @api Calls authClient.signIn.social({ provider: "google" }).
 */
export function GoogleSignInButton({
  className,
  callbackURL,
  ...props
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const targetCallbackURL =
        callbackURL || (origin ? `${origin}/app` : "/app");
      const targetErrorCallbackURL = origin
        ? `${origin}/sign-in?error=auth_failed`
        : undefined;

      await authClient.signIn.social({
        provider: "google",
        callbackURL: targetCallbackURL,
        errorCallbackURL: targetErrorCallbackURL,
      });
    } catch (err) {
      console.error("Sign-in error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to authenticate with Google. Please try again.";
      toast.error("Sign-in Failed", message);
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
