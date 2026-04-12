import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
          &larr; Back
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

          <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Spenditure ("the Service"), operated by Initium Professional Services LLC
                ("Company," "we," "us," or "our"), you agree to be bound by these Terms of
                Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.
                We reserve the right to update these Terms at any time. Material changes will be communicated
                via the Service or email, and your continued use constitutes acceptance of the updated Terms.
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
              <p className="mt-2">
                The Service is provided for informational and educational purposes only. We may modify,
                suspend, or discontinue any part of the Service at any time without prior notice.
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
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Subscriptions and Billing</h2>
              <p>
                Spenditure offers free and paid subscription tiers. By subscribing to a paid plan, you
                authorize us to charge your payment method on a recurring basis until you cancel. All fees
                are non-refundable except as required by applicable law. We reserve the right to change
                pricing at any time; existing subscribers will be notified before any price increase
                takes effect on their next billing cycle.
              </p>
              <p className="mt-2">
                Free trials provide temporary access to paid features. At the end of a trial period,
                your account will revert to the free tier unless you subscribe to a paid plan. We are
                not obligated to offer free trials and may modify or discontinue them at any time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Privacy</h2>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Prohibited Uses</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Violate any applicable laws or regulations</li>
                <li>Impersonate another person or entity</li>
                <li>Interfere with or disrupt the Service or its infrastructure</li>
                <li>Attempt to gain unauthorized access to other users' accounts or data</li>
                <li>Use the Service for any fraudulent or illegal financial activity</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Scrape, crawl, or use automated tools to extract data from the Service</li>
                <li>Use the Service to provide financial advisory services to third parties</li>
                <li>Share your account credentials with third parties or allow others to access your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Financial Disclaimers</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-900">
                <p>
                  <strong>THE SERVICE DOES NOT PROVIDE FINANCIAL, INVESTMENT, TAX, OR LEGAL ADVICE.</strong>{' '}
                  All information, analysis, suggestions, scores, recommendations, and insights provided
                  through Spenditure are for general informational and educational purposes only and should
                  not be construed as professional advice of any kind.
                </p>
                <p className="mt-2">
                  <strong>You are solely responsible for your financial decisions.</strong> You should
                  consult with qualified financial, tax, and legal professionals before making any financial
                  decisions. We make no representations or warranties regarding the accuracy, completeness,
                  timeliness, or reliability of any financial data, calculations, projections, or
                  recommendations displayed in or generated by the Service.
                </p>
                <p className="mt-2">
                  Transaction data, account balances, categorizations, spending projections, debt
                  calculations, and AI-generated insights may contain errors, delays, or inaccuracies.
                  The Company is not responsible for any losses, damages, or liabilities arising from
                  reliance on information provided by the Service.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Third-Party Services</h2>
              <p>
                The Service integrates with third-party providers (including but not limited to Teller,
                Anthropic, and Stripe) to provide functionality. We are not responsible for the actions,
                content, policies, or practices of any third-party services. Your use of third-party
                services is subject to their respective terms and conditions. We do not control and are
                not liable for any disruptions, errors, or data loss caused by third-party providers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Limitation of Liability</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, INITIUM PROFESSIONAL SERVICES LLC,
                  ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                  LIMITED TO LOSS OF PROFITS, DATA, FINANCIAL LOSSES, MISSED OPPORTUNITIES, OR GOODWILL,
                  ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, REGARDLESS OF
                  THE THEORY OF LIABILITY.
                </p>
                <p className="mt-2">
                  IN NO EVENT SHALL THE COMPANY'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR
                  RELATED TO THE SERVICE EXCEED THE AMOUNT YOU HAVE PAID TO THE COMPANY IN THE TWELVE (12)
                  MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED DOLLARS
                  ($100), WHICHEVER IS GREATER.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY
                KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY.
              </p>
              <p className="mt-2">
                We do not warrant that the Service will be uninterrupted, error-free, or secure; that
                defects will be corrected; that the Service or the servers that make it available are free
                of viruses or other harmful components; or that any financial data or calculations
                provided by the Service will be accurate or reliable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless Initium Professional Services LLC, its
                officers, directors, employees, agents, and affiliates from and against any and all claims,
                liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees)
                arising from or related to: (a) your use of the Service; (b) your violation of these Terms;
                (c) your violation of any applicable laws or regulations; or (d) your financial decisions
                made using information from the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State in
                which Initium Professional Services LLC is organized, without regard to conflict of law
                principles. Any disputes arising from these Terms or the Service shall be resolved through
                binding arbitration in accordance with the rules of the American Arbitration Association,
                unless otherwise required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material
                changes by posting the updated Terms on the Service and updating the "Last updated" date.
                Your continued use of the Service after changes are posted constitutes your acceptance of
                the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Termination</h2>
              <p>
                We may suspend or terminate your access to the Service at any time, with or without cause,
                and with or without notice. You may delete your account at any time through the Settings
                page. Upon termination, your right to use the Service will immediately cease, and we may
                delete your data in accordance with our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">15. Contact</h2>
              <p>
                If you have questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:support@spenditure.co" className="text-indigo-600 hover:underline">
                  support@spenditure.co
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
