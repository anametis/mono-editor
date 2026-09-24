import { Account } from "../../features/account/account";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function AccountPage() {
  return (
    <div className="shell">
      <Account />
    </div>
  );
}
