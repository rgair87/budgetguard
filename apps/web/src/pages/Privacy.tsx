import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
          &larr; Back to login
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

          <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800 text-xs">
              This is a template Privacy Policy. You should have a qualified attorney review and
              customize this policy before using it in production.
            </div>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
              <p>We collect the following types of information when you use Runway:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>
                  <strong>Account information:</strong> Email address and password when you register
                </li>
                <li>
                  <strong>Financial data:</strong> Bank account details, transaction history, account
                  balances, and related financial information obtained through your connected accounts
                </li>
                <li>
                  <strong>Usage data:</strong> How you interact with the Service, including pages
                  visited, features used, and preferences
                </li>
                <li>
                  <strong>Device information:</strong> Browser type, operating system, and IP address
                </li>
                <li>
                  <strong>User-provided content:</strong> Budget goals, notes, categories, and other
                  information you manually enter into the Service
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Service</li>
                <li>Sync and display your financial accounts and transactions</li>
                <li>Categorize transactions and detect recurring subscriptions</li>
                <li>Generate spending insights, budget suggestions, and financial analysis</li>
                <li>Power AI-driven features such as the financial advisor and chat</li>
                <li>Send important account notifications and security alerts</li>
                <li>Respond to your support requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Data Storage & Security</h2>
              <p>
                We take the security of your data seriously. Your financial data is stored in encrypted
                databases with access controls. Passwords are hashed using industry-standard algorithms
                and are never stored in plain text.
              </p>
              <p className="mt-2">
                While we implement reasonable security measures, no method of electronic storage or
                transmission is 100% secure. We cannot guarantee absolute security of your data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Third-Party Services</h2>
              <p>
                Runway integrates with the following third-party services to provide its functionality:
              </p>

              <div className="mt-3 space-y-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Plaid</h3>
                  <p>
                    We use Plaid to securely connect your bank accounts and retrieve financial data.
                    When you link a bank account, Plaid facilitates the connection between Runway and
                    your financial institution. Plaid may collect and process your banking credentials
                    and financial data in accordance with their own{' '}
                    <a
                      href="https://plaid.com/legal/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      privacy policy
                    </a>
                    . Your bank credentials are never stored by Runway directly.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Anthropic (Claude AI)</h3>
                  <p>
                    We use Anthropic's Claude AI to power financial insights, chat features, and
                    intelligent categorization. When you use AI-powered features, relevant financial
                    data may be sent to Anthropic's API for processing. Anthropic processes this data
                    in accordance with their{' '}
                    <a
                      href="https://www.anthropic.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      privacy policy
                    </a>
                    .
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Retention</h2>
              <p>
                We retain your data for as long as your account is active or as needed to provide the
                Service. If you delete your account, we will delete your personal data within 30 days,
                except where we are required to retain it by law or for legitimate business purposes
                (such as resolving disputes or enforcing our agreements).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights</h2>
              <p>
                Depending on your location, you may have the following rights regarding your personal
                data:
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">GDPR Rights (EU/EEA residents)</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Right to access your personal data</li>
                    <li>Right to rectification of inaccurate data</li>
                    <li>Right to erasure ("right to be forgotten")</li>
                    <li>Right to restrict processing</li>
                    <li>Right to data portability</li>
                    <li>Right to object to processing</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">CCPA Rights (California residents)</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Right to know what personal information is collected</li>
                    <li>Right to delete personal information</li>
                    <li>Right to opt out of the sale of personal information</li>
                    <li>Right to non-discrimination for exercising your rights</li>
                  </ul>
                </div>
              </div>

              <p className="mt-3">
                To exercise any of these rights, please contact us at the email address below.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Cookies & Local Storage</h2>
              <p>
                Runway uses browser local storage to maintain your authentication session and
                application preferences. We do not use third-party tracking cookies. Essential
                storage is required for the Service to function properly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material
                changes by posting the updated policy on the Service and updating the "Last updated"
                date. Your continued use of the Service after changes are posted constitutes your
                acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact</h2>
              <p>
                If you have questions about this Privacy Policy or wish to exercise your data rights,
                please contact us at{' '}
                <a href="mailto:privacy@runwayfinance.app" className="text-indigo-600 hover:underline">
                  privacy@runwayfinance.app
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
