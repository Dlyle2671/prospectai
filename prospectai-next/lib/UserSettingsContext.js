// ProspectAI — UserSettingsContext
// Provides per-user settings (sender_emails, icp_weights) via React context
// so all components share a single fetch instead of each fetching independently.

import { createContext, useContext, useState, useEffect } from 'react';

const UserSettingsCtx = createContext({ senderEmails: [], icpWeights: null, reload: () => {} });

export function UserSettingsProvider({ children }) {
  const [senderEmails, setSenderEmails] = useState([]);
  const [icpWeights, setIcpWeights] = useState(null);

  async function loadAll() {
    try {
      const [sRes, iRes] = await Promise.all([
        fetch('/api/user-settings?ns=sender_emails'),
        fetch('/api/user-settings?ns=icp_weights'),
      ]);
      const [sData, iData] = await Promise.all([sRes.json(), iRes.json()]);
      if (sData.data) {
        setSenderEmails(typeof sData.data === 'string' ? JSON.parse(sData.data) : sData.data);
      }
      if (iData.data) {
        setIcpWeights(typeof iData.data === 'string' ? JSON.parse(iData.data) : iData.data);
      }
    } catch (e) {
      console.error('UserSettingsProvider load error', e);
    }
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <UserSettingsCtx.Provider value={{ senderEmails, setSenderEmails, icpWeights, setIcpWeights, reload: loadAll }}>
      {children}
    </UserSettingsCtx.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsCtx);
}
