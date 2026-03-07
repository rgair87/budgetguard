import { PlaidLinkButton } from './PlaidLink';
import { useQueryClient } from '@tanstack/react-query';

const steps = [
  {
    number: '1',
    title: 'Link your bank account',
    description: 'Securely connect your bank or credit card through Plaid.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'We analyze your spending',
    description: 'Our AI reviews your transactions and detects subscriptions.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Get personalized budgets',
    description: 'Receive AI-powered budgets and savings recommendations.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

interface Props {
  firstName?: string;
  onDismiss: () => void;
}

export function OnboardingWelcome({ firstName, onDismiss }: Props) {
  const queryClient = useQueryClient();

  return (
    <div className="animate-fade-in-up flex flex-col items-center">
      {/* Hero */}
      <div className="text-center max-w-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg">
          <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Welcome{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Get started in 3 simple steps to take control of your finances.
        </p>
      </div>

      {/* Steps */}
      <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className="card text-center animate-fade-in-up"
            style={{ animationDelay: `${i * 100 + 100}ms`, opacity: 0 }}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              {step.icon}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                {step.number}
              </span>
              <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">{step.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <PlaidLinkButton
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        >
          Link Your Bank Account
        </PlaidLinkButton>
        <button
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onDismiss}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
