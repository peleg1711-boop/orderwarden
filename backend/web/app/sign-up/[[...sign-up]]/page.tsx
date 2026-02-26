import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <SignUp appearance={{ variables: { colorPrimary: "#315efb" } }} />
    </div>
  );
}
