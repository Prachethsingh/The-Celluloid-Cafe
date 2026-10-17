import { useCallback, useEffect, useState } from 'react';

const read = () => ['home', 'search', 'library', 'admin'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
export function useNavigation() {
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const changed = () => setTab(read());
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); };
  }, []);
  const navigate = useCallback(value => { history.pushState({}, '', '#' + value); setTab(value); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, []);
  return [tab, navigate];
}
