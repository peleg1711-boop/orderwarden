import Link from "next/link";

const TopNav = () => {
  return (
    <header className="top-nav">
      <div className="logo">OrderWarden</div>
      <nav className="nav-links">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/orders">Orders</Link>
        <Link href="/new-order">New Order</Link>
      </nav>
    </header>
  );
};

export default TopNav;
