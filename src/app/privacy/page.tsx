import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL, SUBPROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How otterfund collects, uses, protects, and shares your personal and financial information, including bank connections via Plaid, AI processing, payments, your rights, and how to contact us.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · otterfund",
    description: "How otterfund handles your personal and financial information.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" docType="privacy">
      <p>
        This Privacy Policy explains how {LEGAL.entity} (&ldquo;{LEGAL.service}
        ,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
        collects, uses, stores, shares, and protects your information when you
        use the {LEGAL.service} budgeting application and website at{" "}
        <a href={LEGAL.site}>{LEGAL.site.replace("https://", "")}</a> (together,
        the &ldquo;Service&rdquo;). By creating an account or using the Service,
        you agree to the practices described here. If you do not agree, please do
        not use the Service.
      </p>
      <p>
        Because {LEGAL.service} handles sensitive financial information, we hold
        ourselves to a high standard: we collect only what we need to run the
        Service, we never sell your personal information, and we give you tools
        to export or permanently delete your data at any time.
      </p>

      <h2 id="information-we-collect">1. Information We Collect</h2>

      <h3>a. Information you provide to us</h3>
      <ul>
        <li>
          <strong>Account information.</strong> When you register, we collect
          your name and email address. Your password is set and stored by our
          authentication provider (Supabase) in hashed form; we never see or
          store your plaintext password. If you sign up with Google, we receive
          basic profile information (name and email) from Google.
        </li>
        <li>
          <strong>Financial profile.</strong> Details you enter during
          onboarding and in settings, such as your monthly income, preferred
          currency, budget target, and chosen budgeting plan (for example, the
          50/30/20 rule).
        </li>
        <li>
          <strong>Financial records you create.</strong> Accounts, transactions,
          categories, budgets, savings goals, goal allocations, subscriptions,
          bills, and investment holdings (including names, symbols, values, and
          cost basis) that you add manually or import.
        </li>
        <li>
          <strong>Uploaded documents.</strong> Bank or credit-card statements
          (for example, PDF files) that you choose to upload so we can extract
          and categorize the transactions in them.
        </li>
        <li>
          <strong>AI advisor conversations.</strong> The questions you ask our AI
          advisor and the messages exchanged, which we store so you can revisit
          past conversations.
        </li>
        <li>
          <strong>Support and communications.</strong> Information you provide
          when you contact us for support or otherwise communicate with us.
        </li>
      </ul>

      <h3>b. Information from your connected financial accounts (Plaid)</h3>
      <p>
        If you choose to connect a bank or financial account, we use{" "}
        <strong>Plaid Inc.</strong> to establish the connection. You enter your
        bank credentials directly with Plaid&rsquo;s secure interface.{" "}
        <strong>We never see or store your bank login credentials.</strong>{" "}
        Through Plaid, and only with your authorization, we receive account
        information such as account names and types, balances, the last few
        digits of account numbers, institution names, and transaction history.
        Your use of Plaid is also governed by{" "}
        <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer">
          Plaid&rsquo;s End User Privacy Policy
        </a>
        .
      </p>

      <h3>c. Payment information (paid plans)</h3>
      <p>
        When you subscribe to a paid plan, payments are processed by our
        third-party payment processor, <strong>Stripe</strong>. You provide your
        payment-card details directly to Stripe, and{" "}
        <strong>we do not collect or store your full card number.</strong> We
        receive limited billing information from Stripe, such as your
        subscription status, plan, billing history, the card brand, and the last
        four digits of your card, to manage your subscription.
      </p>

      <h3>d. Information collected automatically</h3>
      <ul>
        <li>
          <strong>Device and log data.</strong> When you use the Service, our
          servers and infrastructure providers automatically record technical
          information such as your IP address, browser type, device
          information, timestamps, and requested pages, for security, debugging,
          and reliability.
        </li>
        <li>
          <strong>Cookies.</strong> We use strictly necessary cookies to keep
          you signed in and to secure your session. See &ldquo;Cookies&rdquo;
          below.
        </li>
        <li>
          <strong>Usage metrics.</strong> We record aggregate usage of AI
          features (such as token counts and cost) for internal capacity and
          cost management.
        </li>
      </ul>

      <h2 id="how-we-use">2. How We Use Your Information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Provide, operate, maintain, and improve the Service;</li>
        <li>
          Create and manage your account, and sync your connected financial
          accounts;
        </li>
        <li>
          Categorize transactions, detect recurring charges and subscriptions,
          generate budgeting insights, and power the AI advisor;
        </li>
        <li>Calculate your budgets, net worth, savings goals, and progress;</li>
        <li>Process payments and manage subscriptions (via Stripe);</li>
        <li>
          Communicate with you about your account, security, updates, and
          support requests;
        </li>
        <li>
          Protect the Service, detect and prevent fraud and abuse, and enforce
          our Terms of Service;
        </li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p>
        We rely on the following legal bases where applicable: performance of our
        contract with you (to provide the Service), your consent (for example, to
        connect a bank account or process a statement), our legitimate interests
        (to secure and improve the Service), and compliance with legal
        obligations.
      </p>

      <h2 id="ai">3. AI Processing</h2>
      <p>
        Several features rely on artificial intelligence provided by{" "}
        <strong>Anthropic</strong> (the maker of Claude). To power the AI advisor,
        parse uploaded statements, categorize transactions, detect recurring
        charges, and generate insights, we send the relevant data (which may
        include transaction descriptions and amounts, account and budget details,
        the contents of statements you upload, and the messages you send to the
        advisor) to Anthropic&rsquo;s API for processing.
      </p>
      <ul>
        <li>
          We send only the data needed to produce the requested result, and we
          use AI to provide features to you, not to make automated decisions
          that produce legal or similarly significant effects about you.
        </li>
        <li>
          Anthropic processes this data as our service provider under its
          commercial terms and does not use data submitted through its API to
          train its models. See{" "}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            Anthropic&rsquo;s Privacy Policy
          </a>
          .
        </li>
        <li>
          AI output can be inaccurate or incomplete and is provided for
          informational purposes only. It is not financial, investment, tax, or
          legal advice (see our Terms of Service).
        </li>
      </ul>

      <h2 id="how-we-share">4. How We Share Your Information</h2>
      <p>
        <strong>We do not sell your personal information, and we do not share it
        for cross-context behavioral advertising.</strong> We share information
        only in these limited circumstances:
      </p>
      <ul>
        <li>
          <strong>Service providers (subprocessors).</strong> With trusted
          vendors who process data on our behalf to run the Service, under
          contracts that require them to protect your information and use it only
          for the services they provide to us. Our key subprocessors are listed
          below.
        </li>
        <li>
          <strong>At your direction.</strong> When you connect an account or
          otherwise instruct us to share information.
        </li>
        <li>
          <strong>Legal and safety.</strong> When required by law, subpoena, or
          legal process, or when necessary to protect the rights, property, or
          safety of {LEGAL.service}, our users, or others.
        </li>
        <li>
          <strong>Business transfers.</strong> In connection with a merger,
          acquisition, financing, or sale of assets, in which case we will
          continue to protect your information and notify you of any material
          change to this Policy.
        </li>
      </ul>

      <h3>Our subprocessors</h3>
      <div className="of-scroll mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-of-line)] text-[var(--color-of-ink)]">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 pr-4 font-semibold">Data</th>
              <th className="py-2 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-[var(--color-of-line-soft)] align-top text-[var(--color-of-muted)]">
                <td className="py-2.5 pr-4 font-medium text-[var(--color-of-ink)]">
                  {s.policy ? (
                    <a href={s.policy} target="_blank" rel="noopener noreferrer">
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </td>
                <td className="py-2.5 pr-4">{s.purpose}</td>
                <td className="py-2.5 pr-4">{s.data}</td>
                <td className="py-2.5">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="retention">5. Data Retention</h2>
      <p>
        We retain your personal information for as long as your account is active
        or as needed to provide the Service. When you delete your account, we
        delete your profile and associated financial data from our primary
        systems, and we instruct our authentication provider to delete your
        login. Some information may be retained for a limited period where
        necessary to comply with legal obligations, resolve disputes, prevent
        abuse, or complete transactions (for example, billing records retained by
        Stripe). Backups are purged on a rolling schedule. Aggregated or
        de-identified data that cannot reasonably identify you may be retained.
      </p>

      <h2 id="security">6. How We Protect Your Information</h2>
      <ul>
        <li>
          <strong>Encryption in transit.</strong> All traffic to the Service is
          encrypted using TLS/HTTPS, with HSTS enforced.
        </li>
        <li>
          <strong>Encryption at rest.</strong> Sensitive secrets, including the
          access tokens used to connect your bank via Plaid, are encrypted at
          rest using AES-256-GCM.
        </li>
        <li>
          <strong>Credential protection.</strong> Passwords are hashed by our
          authentication provider; we never store them in plaintext. We never
          receive or store your bank login credentials.
        </li>
        <li>
          <strong>Access controls.</strong> Data is scoped to your account, and
          access is restricted and logged.
        </li>
      </ul>
      <p>
        No method of transmission or storage is completely secure. While we work
        hard to protect your information, we cannot guarantee absolute security.
        Please use a strong, unique password and keep it confidential.
      </p>

      <h2 id="your-rights">7. Your Rights and Choices</h2>
      <p>
        You can access and update much of your information directly in the app.
        In addition, you may:
      </p>
      <ul>
        <li>
          <strong>Export your data.</strong> Download a copy of your data from
          the app&rsquo;s settings at any time.
        </li>
        <li>
          <strong>Delete your account.</strong> Permanently delete your account
          and associated data from within settings. This action is irreversible.
        </li>
        <li>
          <strong>Disconnect a bank.</strong> Unlink any connected financial
          institution at any time.
        </li>
        <li>
          <strong>Access, correct, or object.</strong> Request access to,
          correction of, or restriction of the processing of your personal
          information by contacting us.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have additional rights (see
        &ldquo;Region-Specific Disclosures&rdquo; below). To exercise any right,
        contact us at{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. We will
        not discriminate against you for exercising your rights.
      </p>

      <h2 id="international">8. Data Location and International Transfers</h2>
      <p>
        We store data using infrastructure located in Canada and the United
        States. Some of our subprocessors (including Plaid, Anthropic, and Stripe)
        are located in the United States, so your information may be transferred
        to, stored in, and processed in the United States and other countries
        that may have data-protection laws different from those in your
        jurisdiction. Where required, we rely on appropriate safeguards (such as
        Standard Contractual Clauses) for international transfers.
      </p>

      <h2 id="cookies">9. Cookies</h2>
      <p>
        We use strictly necessary cookies to authenticate you and keep your
        session secure. These cookies are required for the Service to function
        and cannot be switched off through the Service. We do not use advertising
        or cross-site tracking cookies. You can control cookies through your
        browser settings, but disabling necessary cookies will prevent you from
        signing in.
      </p>

      <h2 id="children">10. Children&rsquo;s Privacy (COPPA)</h2>
      <p>
        The Service is intended for adults and is{" "}
        <strong>not directed to children under {LEGAL.minAge}</strong>. In
        particular, consistent with the U.S. Children&rsquo;s Online Privacy
        Protection Act (&ldquo;COPPA&rdquo;),{" "}
        <strong>
          we do not knowingly collect personal information from children under 13
        </strong>
        , and children under 13 are not permitted to use the Service. If you
        believe a child under 13 has provided us with personal information, or if
        you are a parent or guardian and become aware that your child has done so,
        please contact us at{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. If we
        learn that we have collected personal information from a child under 13
        without verifiable parental consent, we will delete that information
        promptly.
      </p>

      <h2 id="regional">11. Region-Specific Disclosures</h2>

      <h3>Canada (PIPEDA)</h3>
      <p>
        If you are in Canada, we handle your personal information in accordance
        with the Personal Information Protection and Electronic Documents Act
        (PIPEDA) and applicable provincial laws. You may request access to, or
        correction of, your personal information, and you may withdraw consent
        (subject to legal or contractual restrictions) by contacting us. You may
        also contact the Office of the Privacy Commissioner of Canada.
      </p>

      <h3>European Economic Area and United Kingdom (GDPR)</h3>
      <p>
        If you are in the EEA or the UK, {LEGAL.service} is the data controller of
        your personal data. You have the rights to access, rectify, erase,
        restrict, and port your data, to object to certain processing, and to
        withdraw consent at any time. You may lodge a complaint with your local
        supervisory authority. The legal bases for our processing are described in
        &ldquo;How We Use Your Information&rdquo; above.
      </p>

      <h3>California (CCPA/CPRA)</h3>
      <p>
        If you are a California resident, you have the right to know what personal
        information we collect and how we use and disclose it, to request access
        to and deletion of your personal information, to correct inaccurate
        information, and to be free from discrimination for exercising your
        rights. <strong>We do not sell or share your personal information</strong>{" "}
        as those terms are defined under the CCPA/CPRA. To exercise your rights,
        contact us at{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
      </p>

      <h2 id="changes">12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make material
        changes, we will update the &ldquo;Last updated&rdquo; date above and, if
        appropriate, notify you through the Service or by email. Your continued
        use of the Service after an update means you accept the revised Policy.
      </p>

      <h2 id="contact">13. Contact Us</h2>
      <p>
        If you have questions or requests about this Privacy Policy or your
        personal information, contact us at:
      </p>
      <ul>
        <li>
          Email: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>
        </li>
        <li>{LEGAL.entity}</li>
        <li>{LEGAL.address}</li>
      </ul>
    </LegalShell>
  );
}
