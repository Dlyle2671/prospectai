import Head from 'next/head';
import OnboardingWizard from '../components/OnboardingWizard';

export default function OnboardingPage() {
    return (
          <>
            <Head>
              <title>Welcome to ProspectAI — Setup</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
              <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap"
            rel="stylesheet"
          />
              </Head>
        <OnboardingWizard />
              </>
    );
}
