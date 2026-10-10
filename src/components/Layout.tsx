import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useEffect } from 'react';
import { syncAuctionTransactions } from '../lib/auctionSync';

export default function Layout() {
  useEffect(() => {
    syncAuctionTransactions();
  }, []);

  return <div className="min-h-screen bg-stone-800"><Header /><Outlet /><Footer /></div>;
}
