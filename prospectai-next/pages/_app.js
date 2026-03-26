import { ClerkProvider } from '@clerk/nextjs';
import { UserSettingsProvider } from '../lib/UserSettingsContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <ClerkProvider {...pageProps}>
      <UserSettingsProvider>
        <Component {...pageProps} />
      </UserSettingsProvider>
    </ClerkProvider>
  );
}
