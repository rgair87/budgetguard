import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
          &larr; Back to login
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

          <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Spenditure ("the Service"), you agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use the Service. We reserve
                the right to update these terms at any time, and your continued use of the Service
                constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
              <p>
                Spenditure is a personal finance management application that helps users track expenses,
                manage budgets, monitor subscriptions, and plan their financial future. The Service
                may include features such as bank account connections via third-party providers,
                transaction categorization, spending analysis, and AI-powered financial insights.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. User Accounts</h2>
              <p>
                To use the Service, you must create an account with a valid email address and password.
                You are responsible for maintaining the confidentiality of your account credentials and
                for all activities that occur under your account. You agree to notify us immediately of
                any unauthorized use of your account.
              </p>
              <p className="mt-2">
                You must be at least 18 years old to create an account and use the Service. You agree
                to provide accurate and complete information when creating your account and to keep
                this information up to date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Privacy</h2>
              <p>
                Your use of the Service is also governed by our{' '}
                <Link to="/privacy" className="text-indigo-600 hover:underline">
                  Privacy Policy
                </Link>
                , which describes how we collect, use, and protect your personal information. By using
                the Service, you consent to the practices described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Prohibited Uses</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Violate any applicable laws or regulations</li>
                <li>Impersonate another person or entity</li>
                <li>Interfere with or disrupt the Service or its infrastructure</li>
                <li>Attempt to gain unauthorized access to other users' accounts or data</li>
                <li>Use the Service for any fraudulent or illegal financial activity</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Scrape, crawl, or use automated tools to extract data from the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Financial Disclaimers</h2>
              <p>
                <strong>The Service does not provide financial advice.</strong> All information,
                analysis, suggestions, and insights provided through Spenditure are for informational
                purposes only and should not be construed as professional financial, investment, tax,
                or legal advice.
              </p>
              <p className="mt-2">
                You should consult with qualified financial professionals before making any financial
                decisions. We do not guarantee the accuracy, completeness, or timeliness of any
                financial data displayed in the Service. Transaction data, account balances, and
                categorizations may contain errors or delays.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Spenditure and its operators shall not be liable
                for any indirect, incidental, special, consequential, or punitive damages, including
                but not limited to loss of profits, data, or financial losses, arising from your use
                of or inability to use the Service.
              </p>
              <p className="mt-2">
                The Service is provided "as is" and "as available" without warranties of any kind,
                either express or implied, including but not limited to implied warranties of
                merchantability, fitness for a particular purpose, and non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms of Service at any time. We will notify
                users of material changes by posting the updated terms on the Service and updating
                the "Last updated" date. Your continued use of the Service after changes are posted
                constitutes your acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Termination</h2>
              <p>
                We may suspend or terminate your access to the Service at any time, with or without
                cause, and with or without notice. You may also delete your account at any time
                through the Settings page. Upon termination, your right to use the Service will
                immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contact</h2>
              <p>
                If you have questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:support@runwayfinance.app" className="text-indigo-600 hover:underline">
                  support@runwayfinance.app
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
