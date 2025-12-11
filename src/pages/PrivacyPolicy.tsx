import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link 
          to="/auth" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy for BizGuard Browser Extension</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 11, 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground">
            BizGuard ("the Extension") is a brand-safety tool designed for internal use by Bizcuits Tech and its authorized support agents. This Privacy Policy explains what information the Extension processes and how it is handled.
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Information We Do Not Collect</h2>
            <p className="text-muted-foreground mb-4">The BizGuard extension:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>❌ Does not collect or store personal information</li>
              <li>❌ Does not collect browsing history</li>
              <li>❌ Does not track user behavior across websites</li>
              <li>❌ Does not sell or share data with third parties</li>
              <li>❌ Does not read or transmit full message content</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              The Extension analyzes text only locally on the user's device to detect brand-conflict terms. No typed content is uploaded or stored.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information Processed Locally (Not Sent to Us)</h2>
            <p className="text-muted-foreground mb-4">The extension locally processes:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Brand names and terms you type</li>
              <li>• Whether a mismatch occurs</li>
              <li>• Whether the extension is active or inactive</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              This processing happens entirely inside the user's browser and is not transmitted.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Information That May Be Sent to Our Backend</h2>
            <p className="text-muted-foreground mb-4">
              For internal security and auditing, the extension may send limited non-personal events such as:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• User's authenticated company ID (after Microsoft login)</li>
              <li>• Timestamp of a brand mismatch</li>
              <li>• The conflicting brand term</li>
              <li>• Whether the extension was turned on/off</li>
            </ul>
            <p className="text-muted-foreground mt-4">This data is only used for:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Internal compliance</li>
              <li>• Brand-safety monitoring</li>
              <li>• Security auditing</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              No personal user data, message content, or browsing data is transmitted.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Authentication</h2>
            <p className="text-muted-foreground">
              The extension uses Microsoft Azure AD to authenticate company users. Bizcuits Tech does not receive your Microsoft password or sensitive credentials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Sharing</h2>
            <p className="text-muted-foreground mb-4">BizGuard does not:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Share data externally</li>
              <li>• Use analytics providers</li>
              <li>• Use advertising networks</li>
              <li>• Sell data</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              All data stays within Bizcuits Tech's secure systems.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement industry-standard technical and organizational measures to secure all data transmitted to our backend, including:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• HTTPS encryption</li>
              <li>• Strict access controls</li>
              <li>• Role-based access for administrators</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. User Rights</h2>
            <p className="text-muted-foreground mb-4">
              As an internal corporate tool, BizGuard users may request:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• To view logged audit events associated with their account</li>
              <li>• To correct or remove data when legally permitted</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Contact your system administrator or Bizcuits Tech IT for requests.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this policy periodically. The "Last updated" date will always reflect the most recent version.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground">
              For questions about this Privacy Policy or BizGuard:
            </p>
            <div className="mt-4 text-muted-foreground">
              <p className="font-semibold text-foreground">Bizcuits Tech</p>
              <p>Email: <a href="mailto:it@bizcuits.io" className="text-primary hover:underline">it@bizcuits.io</a></p>
              <p>Website: <a href="https://bizcuits.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://bizcuits.io</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
