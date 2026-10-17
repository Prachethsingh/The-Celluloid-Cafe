import { Search, User, ShieldCheck, Layers, SquarePlay } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, contentFilter, setContentFilter, onOpenAuth, onOpenSearch, onOpenVega }) {
  const goHome = () => { setActiveTab('home'); setContentFilter?.('all'); };
  const goMovies = () => { setActiveTab('home'); setContentFilter?.('movies'); };
  return <header className="navbar-container">
    <div className="navbar-inner">
      <button className="brand-lockup" onClick={goHome} aria-label="CinePulse home"><span className="brand-mark"><SquarePlay size={22} /></span><span className="brand-name"><span>CINE</span><span className="brand-accent">PULSE</span></span></button>
      <nav className="primary-navigation" aria-label="Main navigation">
        <button className={activeTab === 'home' ? 'active' : ''} aria-current={activeTab === 'home' ? 'page' : undefined} onClick={goHome}>Discover</button>
        <button className={activeTab === 'home' && contentFilter === 'movies' ? 'active' : ''} aria-pressed={activeTab === 'home' && contentFilter === 'movies'} onClick={goMovies}>Movies</button>
        <button onClick={onOpenVega}>Watch free</button>
        <button className={activeTab === 'library' ? 'active' : ''} aria-label="Library" aria-current={activeTab === 'library' ? 'page' : undefined} onClick={() => setActiveTab('library')}>Watchlist</button>
      </nav>
      <div className="navbar-right">
        <button className="utility-button search-utility-button" onClick={onOpenSearch} aria-label="Search" title="Search"><Search size={21} /></button>
        <button className="utility-button provider-utility-button" onClick={onOpenVega} aria-label="Vega Providers" title="Browse providers"><Layers size={17} /></button>
        <button className="utility-button admin-utility-button" onClick={() => setActiveTab('admin')} aria-label="Admin Dashboard" title="Administration"><ShieldCheck size={17} /></button>
        <button className="utility-button account-nav-button" onClick={onOpenAuth} aria-label="User Profile" title="Account"><span className="account-initials">CP</span><User className="account-icon" size={18} /></button>
      </div>
    </div>
  </header>;
}
