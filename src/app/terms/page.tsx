import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL } from "@/lib/legal";
import { Wordmark } from "@/components/otterfund/wordmark";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of otterfund: eligibility, accounts, bank connections, AI features, subscriptions and billing, disclaimers, and your rights and responsibilities.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service · otterfund",
    description: "The terms that govern your use of otterfund.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" docType="terms">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement
        between you and {LEGAL.entity} (&ldquo;{LEGAL.service},&rdquo; &ldquo;
        we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your access
        to and use of the {LEGAL.service} budgeting application and website at{" "}
        <a href={LEGAL.site}>{LEGAL.site.replace("https://", "")}</a> (the
        &ldquo;Service&rdquo;). By creating an account, checking the box to accept
        these Terms, or otherwise accessing or using the Service, you agree to be
        bound by these Terms and by our{" "}
        <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the
        Service.
      </p>
      <p>
        <strong>
          Please read Sections 6, 13, 14, and 15 carefully. They describe that the
          Service is not financial advice and contain important disclaimers and
          limitations of our liability.
        </strong>
      </p>

      <h2 id="eligibility">1. Eligibility</h2>
      <p>
        You must be at least {LEGAL.minAge} years old and able to form a binding
        contract to use the Service. The Service is not directed to and may not be
        used by children under 13, and we do not knowingly permit them to
        register (see our Privacy Policy, &ldquo;Children&rsquo;s Privacy&rdquo;).
        By using the Service, you represent that you meet these requirements and
        that the information you provide is accurate and complete.
      </p>

      <h2 id="service">2. The Service</h2>
      <p>
        {LEGAL.service} is a personal budgeting and money-management tool that
        helps you track accounts, categorize spending, plan a budget across Needs,
        Wants, and Savings, set savings goals, monitor investments you enter, and
        receive AI-generated insights. We may add, change, or remove features at
        any time. The Service provides information and tools to help you manage
        your own money; it does not hold funds, move money, or execute
        transactions on your behalf.
      </p>

      <h2 id="accounts">3. Your Account</h2>
      <ul>
        <li>
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activity under your account.
        </li>
        <li>
          You agree to provide accurate information and to keep it up to date.
        </li>
        <li>
          Notify us promptly at{" "}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> if you
          suspect any unauthorized use of your account.
        </li>
        <li>
          You may not share your account, or transfer it to anyone else, without
          our permission.
        </li>
      </ul>

      <h2 id="bank-connections">4. Connecting Financial Accounts</h2>
      <p>
        The Service lets you connect bank and financial accounts through{" "}
        <strong>Plaid Inc.</strong> By connecting an account, you authorize us and
        Plaid to access and retrieve information from your financial institution
        on your behalf, and you agree to{" "}
        <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer">
          Plaid&rsquo;s End User Privacy Policy
        </a>
        . You represent that you are authorized to provide account credentials and
        to grant this access. You are responsible for reviewing the accuracy of
        imported data. You can disconnect an institution at any time.
      </p>

      <h2 id="ai-not-advice">5. AI Features</h2>
      <p>
        The Service uses artificial intelligence (provided by Anthropic) to
        categorize transactions, parse statements you upload, detect recurring
        charges, and generate insights and advisor responses. AI output is
        generated automatically, may be inaccurate, incomplete, or out of date,
        and should not be relied upon as your sole basis for any decision. You are
        responsible for reviewing and verifying any AI-generated content before
        acting on it.
      </p>

      <h2 id="no-advice">6. Not Financial, Investment, Tax, or Legal Advice</h2>
      <p>
        {LEGAL.service} is a self-directed tool for informational and
        organizational purposes only.{" "}
        <strong>
          We are not a bank, broker-dealer, investment adviser, financial planner,
          tax adviser, or fiduciary, and nothing in the Service constitutes
          financial, investment, tax, accounting, or legal advice.
        </strong>{" "}
        Budget plans (such as the 50/30/20 rule), insights, market data, net-worth
        figures, and AI responses are general information, not recommendations
        tailored to your circumstances. Market and pricing data may be delayed or
        inaccurate and is provided &ldquo;as is.&rdquo; You are solely responsible
        for your financial decisions. Consider consulting a qualified professional
        before making significant financial decisions.
      </p>

      <h2 id="billing">7. Subscriptions, Billing, and Payments</h2>
      <p>
        {LEGAL.service} offers a free tier and paid subscription plans. Paid plans
        are billed through our payment processor, <strong>Stripe</strong>, and
        your use of Stripe is subject to Stripe&rsquo;s terms.
      </p>
      <ul>
        <li>
          <strong>Fees and billing cycles.</strong> Paid plans are offered on a
          monthly or annual basis at the prices shown on our pricing page. By
          subscribing, you authorize us and Stripe to charge your payment method
          the applicable fees, plus any taxes, on a recurring basis.
        </li>
        <li>
          <strong>Automatic renewal.</strong> Subscriptions automatically renew at
          the end of each billing period at the then-current price unless you
          cancel before the renewal date.
        </li>
        <li>
          <strong>Cancellation.</strong> You may cancel at any time; cancellation
          takes effect at the end of the current billing period, and you will
          retain paid features until then.
        </li>
        <li>
          <strong>Refunds.</strong> Except where required by law, fees are
          non-refundable and partial periods are not prorated.
        </li>
        <li>
          <strong>Price changes.</strong> We may change prices or plan features;
          we will give you advance notice, and changes take effect at your next
          billing period.
        </li>
        <li>
          <strong>Taxes.</strong> Prices exclude taxes unless stated; you are
          responsible for applicable taxes.
        </li>
        <li>
          <strong>Failed payments.</strong> If a payment fails, we may suspend or
          downgrade your access to paid features.
        </li>
      </ul>

      <h2 id="user-content">8. Your Content and License</h2>
      <p>
        You retain all rights to the information and content you submit to the
        Service (&ldquo;Your Content&rdquo;), including your financial data. You
        grant us a limited, non-exclusive, worldwide, royalty-free license to
        host, store, process, transmit, and display Your Content solely to operate
        and provide the Service to you (including sending it to the subprocessors
        described in our Privacy Policy). If you send us feedback or suggestions,
        you grant us the right to use them without restriction or compensation.
      </p>

      <h2 id="acceptable-use">9. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service in violation of any law or these Terms;</li>
        <li>
          Access another person&rsquo;s account or data, or provide credentials
          for accounts you are not authorized to access;
        </li>
        <li>
          Reverse engineer, scrape, copy, or create derivative works of the
          Service except as permitted by law;
        </li>
        <li>
          Interfere with, disrupt, overload, or attempt to gain unauthorized
          access to the Service or its infrastructure;
        </li>
        <li>
          Upload malware or use the Service to transmit unlawful, infringing, or
          harmful content;
        </li>
        <li>
          Use the Service to build a competing product or resell it without our
          written permission.
        </li>
      </ul>

      <h2 id="ip">10. Intellectual Property</h2>
      <p>
        The Service, including its software, design, branding, the <Wordmark />{" "}
        name and logo, and all related content (excluding Your Content), is owned
        by{" "}
        {LEGAL.entity} or its licensors and is protected by intellectual-property
        laws. We grant you a limited, non-exclusive, non-transferable, revocable
        license to use the Service for your personal, non-commercial use in
        accordance with these Terms. All rights not expressly granted are
        reserved.
      </p>

      <h2 id="third-party">11. Third-Party Services</h2>
      <p>
        The Service integrates with third-party services (including Plaid,
        Anthropic, Stripe, and market-data providers) and may link to third-party
        sites. We are not responsible for third-party services or their content,
        and your use of them is governed by their own terms and privacy policies.
      </p>

      <h2 id="disclaimers">12. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
        IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
        WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR
        THAT ANY DATA (INCLUDING IMPORTED TRANSACTIONS, MARKET DATA, OR
        AI-GENERATED CONTENT) WILL BE ACCURATE OR COMPLETE. SOME JURISDICTIONS DO
        NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES, SO SOME OF THE ABOVE MAY
        NOT APPLY TO YOU.
      </p>

      <h2 id="liability">13. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL.service.toUpperCase()} AND
        ITS OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
        DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER
        INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF (OR INABILITY
        TO USE) THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. TO
        THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS
        RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU
        PAID US IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE LIABILITY,
        OR (B) ONE HUNDRED U.S. DOLLARS (US$100). SOME JURISDICTIONS DO NOT ALLOW
        CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.
      </p>

      <h2 id="indemnification">14. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless {LEGAL.entity} and its officers,
        employees, and agents from and against any claims, liabilities, damages,
        losses, and expenses (including reasonable legal fees) arising out of or
        related to your use of the Service, Your Content, your violation of these
        Terms, or your violation of any law or third-party right.
      </p>

      <h2 id="termination">15. Suspension and Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may
        suspend or terminate your access to the Service, with or without notice,
        if you violate these Terms, if required by law, or if necessary to protect
        the Service or other users. Upon termination, your right to use the
        Service ceases. Sections that by their nature should survive termination
        (including intellectual property, disclaimers, limitation of liability,
        indemnification, and governing law) will survive.
      </p>

      <h2 id="changes">16. Changes to the Service and These Terms</h2>
      <p>
        We may modify these Terms from time to time. When we make material
        changes, we will update the &ldquo;Last updated&rdquo; date above and, if
        appropriate, notify you through the Service or by email. Changes are
        effective when posted. Your continued use of the Service after changes
        take effect constitutes acceptance of the revised Terms.
      </p>

      <h2 id="governing-law">17. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of {LEGAL.governingLaw}, without
        regard to its conflict-of-laws rules. You agree to first try to resolve any
        dispute informally by contacting us at{" "}
        <a href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</a>. If a dispute
        cannot be resolved, you agree to the exclusive jurisdiction of{" "}
        {LEGAL.courts} for all disputes not subject to any binding arbitration or
        small-claims option, and you waive any objection to venue there. Nothing
        in these Terms limits any mandatory consumer-protection rights you have
        under the laws of your place of residence.
      </p>

      <h2 id="misc">18. General</h2>
      <ul>
        <li>
          <strong>Entire agreement.</strong> These Terms and the Privacy Policy
          are the entire agreement between you and us regarding the Service.
        </li>
        <li>
          <strong>Severability.</strong> If any provision is held unenforceable,
          the rest remains in effect.
        </li>
        <li>
          <strong>No waiver.</strong> Our failure to enforce a provision is not a
          waiver of it.
        </li>
        <li>
          <strong>Assignment.</strong> You may not assign these Terms without our
          consent; we may assign them in connection with a merger, acquisition, or
          sale of assets.
        </li>
        <li>
          <strong>Force majeure.</strong> We are not liable for delays or failures
          caused by events beyond our reasonable control.
        </li>
        <li>
          <strong>Notices.</strong> We may provide notices through the Service or
          by email to the address on your account.
        </li>
      </ul>

      <h2 id="contact">19. Contact Us</h2>
      <p>Questions about these Terms? Contact us at:</p>
      <ul>
        <li>
          Email: <a href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</a>
        </li>
        <li>{LEGAL.entity}</li>
        <li>{LEGAL.address}</li>
      </ul>
    </LegalShell>
  );
}
