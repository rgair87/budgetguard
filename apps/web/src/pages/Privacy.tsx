import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
          &larr; Back
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

          <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <section>
              <p>
                This Privacy Policy describes how Initium Professional Services LLC ("Company," "we,"
                "us," or "our"), operating as Spenditure, collects, uses, stores, and protects your
                information when you use our personal finance application and related services
                (collectively, the "Service").
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
              <p>We collect the following types of information when you use Spenditure:</p>
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
                <li>
                  <strong>AI interaction data:</strong> Messages sent to AI-powered features and the
                  financial data used to generate responses
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
                <li>Process payments and manage subscriptions</li>
                <li>Respond to your support requests</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p className="mt-2">
                <strong>We do not sell your personal information to third parties.</strong> We do not
                use your financial data for advertising purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Data Storage & Security</h2>
              <p>
                We take the security of your data seriously. Your financial data is stored in encrypted
                databases with access controls. Passwords are hashed using industry-standard algorithms
                (bcrypt) and are never stored in plain text.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-3 text-amber-900">
                <p>
                  <strong>No system is 100% secure.</strong> While we implement commercially reasonable
                  security measures, we cannot guarantee the absolute security of your data. You
                  acknowledge that you provide your information at your own risk. We are not responsible
                  for unauthorized access to your data resulting from factors beyond our reasonable
                  control, including but not limited to hacking, cyberattacks, or your own failure to
                  maintain the security of your account credentials.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Third-Party Services</h2>
              <p>
                Spenditure integrates with third-party services to provide its functionality. Each
                third-party provider has its own privacy practices, and we encourage you to review
                their policies:
              </p>

              <div className="mt-3 space-y-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Teller</h3>
                  <p>
                    We use Teller to securely connect your bank accounts and retrieve financial data.
                    When you link a bank account, Teller facilitates the connection between Spenditure and
                    your financial institution. Teller may collect and process your banking credentials
                    and financial data in accordance with their own{' '}
                    <a href="https://teller.io/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      privacy policy
                    </a>
                    . Your bank credentials are never stored by Spenditure directly.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Anthropic (Claude AI)</h3>
                  <p>
                    We use Anthropic's Claude AI to power financial insights, chat features, and
                    intelligent categorization. When you use AI-powered features, relevant financial
                    data may be sent to Anthropic's API for processing. Anthropic processes this data
                    in accordance with their{' '}
                    <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      privacy policy
                    </a>
                    . We use Anthropic's API tier which does not use your data for model training.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Stripe</h3>
                  <p>
                    We use Stripe to process subscription payments. Payment information is collected
                    and processed directly by Stripe and is never stored on our servers. Stripe's
                    handling of your payment data is governed by their{' '}
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      privacy policy
                    </a>
                    .
                  </p>
                </div>
              </div>

              <p className="mt-3">
                We are not responsible for the privacy practices or security measures of any
                third-party service providers. Your use of their services is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Accuracy Disclaimer</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <p>
                  Financial data displayed in the Service (including account balances, transaction
                  amounts, spending categories, projections, and generated insights) may be
                  inaccurate, incomplete, or delayed. We rely on third-party providers for financial
                  data and cannot guarantee its accuracy.
                </p>
                <p className="mt-2">
                  <strong>You should always verify financial information directly with your financial
                  institution before making financial decisions.</strong> We are not liable for any
                  losses or damages resulting from inaccurate data displayed in the Service.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Retention</h2>
              <p>
                We retain your data for as long as your account is active or as needed to provide the
                Service. If you delete your account, we will delete your personal data within 30 days,
                except where we are required to retain it by law or for legitimate business purposes
                (such as resolving disputes or enforcing our agreements).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Your Rights</h2>
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
                    <li>Right to opt out of the sale of personal information (we do not sell your data)</li>
                    <li>Right to non-discrimination for exercising your rights</li>
                  </ul>
                </div>
              </div>

              <p className="mt-3">
                To exercise any of these rights, you may use the data export and account deletion
                features in the Service's Settings page, or contact us at the email address below.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Cookies & Local Storage</h2>
              <p>
                Spenditure uses browser local storage to maintain your authentication session and
                application preferences. We do not use third-party tracking cookies or advertising
                trackers. Essential storage is required for the Service to function properly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Children's Privacy</h2>
              <p>
                The Service is not intended for use by anyone under the age of 18. We do not knowingly
                collect personal information from children. If we become aware that we have collected
                data from a child under 18, we will take steps to delete that information promptly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material
                changes by posting the updated policy on the Service and updating the "Last updated"
                date. Your continued use of the Service after changes are posted constitutes your
                acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
              <p>
                If you have questions about this Privacy Policy or wish to exercise your data rights,
                please contact us at{' '}
                <a href="mailto:privacy@spenditure.co" className="text-indigo-600 hover:underline">
                  privacy@spenditure.co
                </a>
                .
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Initium Professional Services LLC
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
