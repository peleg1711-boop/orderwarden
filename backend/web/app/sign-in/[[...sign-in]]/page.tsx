import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="auth-page">
      <SignIn appearance={{ variables: { colorPrimary: "#315efb" } }} />
    </div>
  );
}
