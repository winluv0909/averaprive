"use client";

import { useRef, useState } from "react";
import {
  completeSocialSignUp,
  signUp,
} from "@/app/login/actions";
import EmailVerification from "./EmailVerification";
import CountrySelect from "./CountrySelect";
import LanguageSelect from "./LanguageSelect";

const serviceOptions = [
  "Full-Service OFM",
  "Account Management",
  "Chatting & Sales",
  "Creator Acquisition",
  "Content Strategy",
  "Marketing & Growth",
  "Recruitment & Training",
  "Compliance & Operations",
];

const nicheOptions = [
  "Lifestyle",
  "Fitness",
  "Gaming",
  "Cosplay",
  "Fashion",
  "Adult",
  "Couples",
  "Other",
];

const steps = [
  "Agency Details",
  "Services",
  "Expertise",
  "About & Verification",
  "Review Your Profile",
];

type Values = Record<string, string>;

type RegistrationWizardProps = {
  selectedPlan: string;
  error?: string;
  socialAccount?: {
    email: string;
    firstName: string;
    lastName: string;
  };
};

export default function RegistrationWizard({
  selectedPlan,
  error,
  socialAccount,
}: RegistrationWizardProps) {
  const [step, setStep] = useState(0);
  const explicitSubmission = useRef(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationError, setVerificationError] = useState("");

  const submitRegistration = async (formData: FormData) => {
    if (!explicitSubmission.current || step !== steps.length - 1) {
      explicitSubmission.current = false;
      return;
    }

    explicitSubmission.current = false;
    if (
  !verifiedEmail ||
  verifiedEmail !== String(formData.get("email") ?? "").trim().toLowerCase()
) {
  setVerificationError("Verify your owner email in Step 04 before submitting.");
  setStep(3);
  return;
}

setVerificationError("");
    const registrationAction = socialAccount
      ? completeSocialSignUp
      : signUp;

    await registrationAction(formData);
  };

  const [values, setValues] = useState<Values>({
    plan: selectedPlan,
    email: socialAccount?.email || "",
    firstName: socialAccount?.firstName || "",
    lastName: socialAccount?.lastName || "",
  });

  const [services, setServices] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);

  const set = (name: string, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const toggle = (
    list: string[],
    update: (next: string[]) => void,
    value: string,
  ) => {
    update(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value],
    );
  };

  const move = (direction: number) => {
    explicitSubmission.current = false;

    setStep((current) =>
      Math.max(0, Math.min(steps.length - 1, current + direction)),
    );

    document.getElementById("registration-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <form
      id="registration-form"
      className="registration-wizard"
      action={submitRegistration}
      onSubmitCapture={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter;

        const isSubmitButton =
          submitter instanceof HTMLButtonElement &&
          submitter.dataset.agencySubmit === "true";

        if (
          step !== steps.length - 1 ||
          !isSubmitButton ||
          !explicitSubmission.current
        ) {
          explicitSubmission.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {verificationError && (
  <p className="access-alert error" role="alert">
    {verificationError}
  </p>
)}
      {error && (
        <p className="access-alert error" role="alert">
          {error}
        </p>
      )}

      <input type="hidden" name="next" value="/agency/dashboard" />

      <input
        type="hidden"
        name="registrationFlow"
        value="complete-profile"
      />

      <input
        type="hidden"
        name="services"
        value={services.join(",")}
      />

      <input
        type="hidden"
        name="creatorNiches"
        value={niches.join(",")}
      />

      <div
        className="registration-stepper"
        aria-label="Registration progress"
      >
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            className={
              index === step
                ? "active"
                : index < step
                  ? "complete"
                  : ""
            }
            onClick={(event) => {
              event.preventDefault();
              explicitSubmission.current = false;

              if (index <= step) {
                setStep(index);
              }
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{label}</b>
          </button>
        ))}
      </div>

      <section
        className={
          step === 0 ? "wizard-panel active" : "wizard-panel"
        }
        aria-hidden={step !== 0}
      >
        <header>
          <span>01</span>

          <div>
            <p>AGENCY DETAILS</p>
            <h2>Establish your identity.</h2>

            <small>
              Owner access and the core information creators will use
              to recognize your agency.
            </small>
          </div>
        </header>

        <div className="registration-grid">
          <label>
            <span>FIRST NAME</span>

            <input
              name="firstName"
              value={values.firstName ?? ""}
              onChange={(event) =>
                set("firstName", event.target.value)
              }
              required
            />
          </label>

          <label>
            <span>LAST NAME</span>

            <input
              name="lastName"
              value={values.lastName ?? ""}
              onChange={(event) =>
                set("lastName", event.target.value)
              }
              required
            />
          </label>
        </div>

        <label>
          <span>AGENCY OR COMPANY NAME</span>

          <input
            name="agencyName"
            value={values.agencyName ?? ""}
            onChange={(event) =>
              set("agencyName", event.target.value)
            }
            placeholder="Example: Northstar Creator Management"
            required
            minLength={2}
          />
        </label>

        <div className="registration-grid">
          <div>
  <span className="wizard-field-title">COUNTRY</span>
  <CountrySelect
    name="country"
    label="Agency country"
    value={values.country ?? ""}
    onChange={(value) => set("country", value)}
  />
</div>

          <label>
            <span>CITY</span>

            <input
              name="city"
              value={values.city ?? ""}
              onChange={(event) =>
                set("city", event.target.value)
              }
            />
          </label>
        </div>

        <label>
          <span>OFFICIAL WEBSITE</span>

          <input
            name="websiteUrl"
            type="url"
            value={values.websiteUrl ?? ""}
            onChange={(event) =>
              set("websiteUrl", event.target.value)
            }
            placeholder="https://"
          />
        </label>

        <label>
          <span>LOGO IMAGE URL</span>

          <input
            name="logoUrl"
            type="url"
            value={values.logoUrl ?? ""}
            onChange={(event) =>
              set("logoUrl", event.target.value)
            }
            placeholder="https://yourdomain.com/logo.png"
          />

          <small>
            You can replace this with a managed upload from your
            workspace later.
          </small>
        </label>

        <div className="registration-account-fields">
          <label>
            <span>OWNER EMAIL</span>

            <input
              name="email"
              type="email"
              value={values.email ?? ""}
              onChange={(event) =>
                set("email", event.target.value)
              }
              autoComplete="email"
              readOnly={Boolean(socialAccount)}
              required
            />

            {socialAccount && (
              <small>
                Provided securely by your connected account.
              </small>
            )}
          </label>

          {socialAccount ? (
            <div className="social-password-note">
              <span>✓</span>

              <p>
                <b>Password managed securely</b>

                <small>
                  Google or Apple will authenticate this account.
                  Avera Privé does not receive your provider password.
                </small>
              </p>
            </div>
          ) : (
            <div className="registration-grid registration-password-grid">
  <label>
    <span>CREATE PASSWORD</span>

    <input
      name="password"
      type="password"
      value={values.password ?? ""}
      onChange={(event) => {
        const password = event.target.value;
        set("password", password);

        const confirmation =
          event.currentTarget.form?.elements.namedItem("confirmPassword");

        if (confirmation instanceof HTMLInputElement) {
          confirmation.setCustomValidity(
            confirmation.value && confirmation.value !== password
              ? "Passwords must match."
              : "",
          );
        }
      }}
      minLength={12}
      maxLength={128}
      pattern="(?=.*[A-Za-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{12,128}"
      title="Use at least 12 characters, including an uppercase letter, a number, and a symbol."
      autoComplete="new-password"
      aria-describedby="registration-password-guide"
      required
    />

  </label>

  <label>
    <span>CONFIRM PASSWORD</span>

    <input
      name="confirmPassword"
      type="password"
      value={values.confirmPassword ?? ""}
      onChange={(event) => {
        const confirmation = event.target.value;
        set("confirmPassword", confirmation);

        event.currentTarget.setCustomValidity(
          confirmation !== (values.password ?? "")
            ? "Passwords must match."
            : "",
        );
      }}
      minLength={12}
      maxLength={128}
      autoComplete="new-password"
      required
    />

  </label>
  <p id="registration-password-guide" className="registration-password-guide">
    Use 12–128 characters with at least one uppercase letter, one number,
    and one symbol (for example, ! @ # or %). Both passwords must match.
  </p>
</div>
          )}
        </div>

        <label>
          <span>SELECTED PLAN</span>

          <select
            name="plan"
            value={values.plan ?? selectedPlan}
            onChange={(event) =>
              set("plan", event.target.value)
            }
          >
            <option value="free">Free — $0 forever</option>
            <option value="prive">Privé — $49/month</option>
            <option value="select">Privé Select — $129/month</option>
            <option value="elite">Privé Elite — $299/month</option>
          </select>

          <small>No payment is collected during registration.</small>
        </label>
      </section>

      <section
        className={
          step === 1 ? "wizard-panel active" : "wizard-panel"
        }
        aria-hidden={step !== 1}
      >
        <header>
          <span>02</span>

          <div>
            <p>SERVICES</p>
            <h2>What does your agency do?</h2>

            <small>
              Select every service your team actively delivers.
            </small>
          </div>
        </header>

        <div className="choice-grid">
          {serviceOptions.map((option) => (
            <label
              className={
                services.includes(option) ? "selected" : ""
              }
              key={option}
            >
              <input
                type="checkbox"
                checked={services.includes(option)}
                onChange={() =>
                  toggle(services, setServices, option)
                }
              />

              <span>✓</span>
              <b>{option}</b>
            </label>
          ))}
        </div>

        <label>
          <span>
            OTHER SERVICES <b>COMMA-SEPARATED</b>
          </span>

          <input
            name="otherServices"
            value={values.otherServices ?? ""}
            onChange={(event) =>
              set("otherServices", event.target.value)
            }
            placeholder="Add specialist services"
          />
        </label>
      </section>

      <section
        className={
          step === 2 ? "wizard-panel active" : "wizard-panel"
        }
        aria-hidden={step !== 2}
      >
        <header>
          <span>03</span>

          <div>
            <p>EXPERTISE</p>
            <h2>Define your operating fit.</h2>

            <small>
              Help creators understand your market experience, scale,
              and reach.
            </small>
          </div>
        </header>

        <p className="wizard-field-title">CREATOR NICHES</p>

        <div className="choice-grid compact">
          {nicheOptions.map((option) => (
            <label
              className={
                niches.includes(option) ? "selected" : ""
              }
              key={option}
            >
              <input
                type="checkbox"
                checked={niches.includes(option)}
                onChange={() =>
                  toggle(niches, setNiches, option)
                }
              />

              <span>✓</span>
              <b>{option}</b>
            </label>
          ))}
        </div>

        <label>
          <span>
            REGIONS SERVED <b>COMMA-SEPARATED</b>
          </span>

          <input
            name="regionsServed"
            value={values.regionsServed ?? ""}
            onChange={(event) =>
              set("regionsServed", event.target.value)
            }
            placeholder="North America, Europe, Southeast Asia"
          />
        </label>

        <div className="registration-grid">
          <label>
            <span>AGENCY SIZE</span>

            <select
              name="agencySize"
              value={values.agencySize ?? ""}
              onChange={(event) =>
                set("agencySize", event.target.value)
              }
              required
            >
              <option value="" disabled>
                Select team size
              </option>

              <option>1–5</option>
              <option>6–15</option>
              <option>16–50</option>
              <option>51–100</option>
              <option>101+</option>
            </select>
          </label>

          <label>
            <span>YEAR FOUNDED</span>

            <input
              name="foundedYear"
              type="number"
              min="1990"
              max="2100"
              value={values.foundedYear ?? ""}
              onChange={(event) =>
                set("foundedYear", event.target.value)
              }
            />
          </label>
        </div>

        <div>
  <span className="wizard-field-title">LANGUAGES</span>
  <LanguageSelect
    value={values.languages ?? ""}
    onChange={(value) => set("languages", value)}
  />
</div>
      </section>

      <section
        className={
          step === 3 ? "wizard-panel active" : "wizard-panel"
        }
        aria-hidden={step !== 3}
      >
        <header>
          <span>04</span>

          <div>
            <p>ABOUT &amp; VERIFICATION</p>
            <h2>Build trust through clarity.</h2>

            <small>
              Profile moderation and business verification are reviewed
              independently.
            </small>
          </div>
        </header>

        <label>
          <span>POSITIONING STATEMENT</span>

          <input
            name="positioning"
            value={values.positioning ?? ""}
            onChange={(event) =>
              set("positioning", event.target.value)
            }
            placeholder="Who you serve, what you specialize in, and where you operate"
            required
            minLength={20}
          />
        </label>

        <label>
          <span>ABOUT YOUR AGENCY</span>

          <textarea
            name="about"
            value={values.about ?? ""}
            onChange={(event) =>
              set("about", event.target.value)
            }
            placeholder="Describe your operating model, team, experience, and approach."
            required
            minLength={80}
          />
        </label>

        <div className="registration-grid">
          <label>
            <span>INSTAGRAM</span>

            <input
              name="instagram"
              value={values.instagram ?? ""}
              onChange={(event) =>
                set("instagram", event.target.value)
              }
              placeholder="https://instagram.com/..."
            />
          </label>

          <label>
            <span>LINKEDIN</span>

            <input
              name="linkedin"
              value={values.linkedin ?? ""}
              onChange={(event) =>
                set("linkedin", event.target.value)
              }
              placeholder="https://linkedin.com/company/..."
            />
          </label>
        </div>
        <EmailVerification
  email={values.email ?? ""}
  onVerified={setVerifiedEmail}
/>
        <div className="verification-readiness">
  <span aria-hidden="true">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  </span>

          <div>
            <b>Independent verification information</b>

            <p>
              These details enter a private verification queue. They
              never appear on the public profile, and payment never
              determines the decision.
            </p>
          </div>
        </div>

        <label>
          <span>LEGAL COMPANY NAME</span>

          <input
            name="legalCompanyName"
            value={values.legalCompanyName ?? ""}
            onChange={(event) =>
              set("legalCompanyName", event.target.value)
            }
            required
          />
        </label>

        <div className="registration-grid">
          <label>
            <span>REGISTRATION NUMBER</span>

            <input
              name="registrationNumber"
              value={values.registrationNumber ?? ""}
              onChange={(event) =>
                set("registrationNumber", event.target.value)
              }
              required
            />
          </label>

          <div>
  <span className="wizard-field-title">REGISTRATION COUNTRY</span>
  <CountrySelect
    name="registrationCountry"
    label="Business registration country"
    value={values.registrationCountry || values.country || ""}
    onChange={(value) => set("registrationCountry", value)}
  />
</div>
        </div>

        <div className="registration-grid">
          <label>
            <span>AUTHORIZED REPRESENTATIVE</span>

            <input
              name="representative"
              value={values.representative ?? ""}
              onChange={(event) =>
                set("representative", event.target.value)
              }
              required
            />
          </label>

          <label>
            <span>REPRESENTATIVE TITLE</span>

            <input
              name="representativeTitle"
              value={values.representativeTitle ?? ""}
              onChange={(event) =>
                set("representativeTitle", event.target.value)
              }
              required
            />
          </label>
        </div>

        <label>
          <span>BUSINESS EMAIL</span>

          <input
            name="businessEmail"
            type="email"
            value={values.businessEmail ?? values.email ?? ""}
            onChange={(event) =>
              set("businessEmail", event.target.value)
            }
            required
          />
        </label>

        <label>
          <span>VERIFICATION NOTES</span>

          <textarea
            name="verificationNotes"
            value={values.verificationNotes ?? ""}
            onChange={(event) =>
              set("verificationNotes", event.target.value)
            }
            placeholder="Identify the company records, official website, and supporting evidence the reviewer should check."
            required
            minLength={20}
          />
        </label>

        <label className="registration-consent">
          <input
            name="authorized"
            type="checkbox"
            required
          />

          <span>
            I confirm that I am authorized to submit and manage this
            agency profile and that the information provided is accurate.
          </span>
        </label>
      </section>

      <section
        className={
          step === 4 ? "wizard-panel active" : "wizard-panel"
        }
        aria-hidden={step !== 4}
      >
        <header>
          <span>05</span>

          <div>
            <p>REVIEW YOUR PROFILE</p>
            <h2>Ready for moderation.</h2>

            <small>
              Review the information below before creating the owner
              account and submitting the agency.
            </small>
          </div>
        </header>

        <div className="review-section-heading">
          <div>
            <p>PUBLIC PROFILE INFORMATION</p>
            <h3>What creators will see</h3>
          </div>

          <span>PUBLIC AFTER APPROVAL</span>
        </div>

        <dl className="registration-review">
          <div>
            <dt>Agency</dt>
            <dd>{values.agencyName || "Not provided"}</dd>
          </div>

          <div>
            <dt>Location</dt>

            <dd>
              {[values.city, values.country]
                .filter(Boolean)
                .join(", ") || "Not provided"}
            </dd>
          </div>

          <div>
            <dt>Website</dt>
            <dd>{values.websiteUrl || "Not provided"}</dd>
          </div>

          <div>
            <dt>Logo image</dt>
            <dd>{values.logoUrl || "Not provided"}</dd>
          </div>

          <div className="wide">
            <dt>Services</dt>

            <dd>
              {[...services, values.otherServices]
                .filter(Boolean)
                .join(", ") || "Not provided"}
            </dd>
          </div>

          <div>
            <dt>Creator niches</dt>
            <dd>{niches.join(", ") || "Not provided"}</dd>
          </div>

          <div>
            <dt>Regions</dt>
            <dd>{values.regionsServed || "Not provided"}</dd>
          </div>

          <div>
            <dt>Agency size</dt>
            <dd>{values.agencySize || "Not provided"}</dd>
          </div>

          <div>
            <dt>Founded</dt>
            <dd>{values.foundedYear || "Not provided"}</dd>
          </div>

          <div>
            <dt>Languages</dt>
            <dd>{values.languages || "Not provided"}</dd>
          </div>

          <div>
            <dt>Requested plan</dt>
            <dd>{values.plan || selectedPlan}</dd>
          </div>

          <div className="wide">
            <dt>Positioning</dt>
            <dd>{values.positioning || "Not provided"}</dd>
          </div>

          <div className="wide">
            <dt>About</dt>
            <dd>{values.about || "Not provided"}</dd>
          </div>

          <div>
            <dt>Instagram</dt>
            <dd>{values.instagram || "Not provided"}</dd>
          </div>

          <div>
            <dt>LinkedIn</dt>
            <dd>{values.linkedin || "Not provided"}</dd>
          </div>
        </dl>

        <div className="review-section-heading private">
          <div>
            <p>PRIVATE VERIFICATION INFORMATION</p>
            <h3>For authorized reviewers only</h3>
          </div>

          <span>NEVER PUBLIC</span>
        </div>

        <dl className="registration-review private-review">
          <div>
            <dt>Account owner</dt>

            <dd>
              {[values.firstName, values.lastName]
                .filter(Boolean)
                .join(" ") || "Not provided"}
            </dd>
          </div>

          <div>
            <dt>Owner email</dt>
            <dd>{values.email || "Not provided"}</dd>
          </div>

          <div>
            <dt>Legal company</dt>
            <dd>{values.legalCompanyName || "Not provided"}</dd>
          </div>

          <div>
            <dt>Registration number</dt>
            <dd>{values.registrationNumber || "Not provided"}</dd>
          </div>

          <div>
            <dt>Registration country</dt>

            <dd>
              {values.registrationCountry ||
                values.country ||
                "Not provided"}
            </dd>
          </div>

          <div>
            <dt>Business email</dt>

            <dd>
              {values.businessEmail ||
                values.email ||
                "Not provided"}
            </dd>
          </div>

          <div>
            <dt>Authorized representative</dt>
            <dd>{values.representative || "Not provided"}</dd>
          </div>

          <div>
            <dt>Representative title</dt>
            <dd>{values.representativeTitle || "Not provided"}</dd>
          </div>

          <div className="wide">
            <dt>Verification notes</dt>
            <dd>{values.verificationNotes || "Not provided"}</dd>
          </div>
        </dl>

        <div className="submission-outcome">
          <div>
            <span>1</span>

            <p>
              <b>Moderation status</b>
              <small>Submitted after email confirmation</small>
            </p>
          </div>

          <div>
            <span>2</span>

            <p>
              <b>Verification status</b>
              <small>Pending independent evidence review</small>
            </p>
          </div>

          <div>
            <span>3</span>

            <p>
              <b>Dashboard access</b>
              <small>Available after secure sign-in</small>
            </p>
          </div>
        </div>
      </section>

      <div className="wizard-actions">
        {step > 0 ? (
          <button
            key="back"
            type="button"
            className="wizard-back"
            onClick={(event) => {
              event.preventDefault();
              move(-1);
            }}
          >
            ← BACK
          </button>
        ) : (
          <span />
        )}

        <span className="wizard-step-count" aria-live="polite">
          Step {step + 1} of {steps.length}
        </span>

        {step < steps.length - 1 ? (
          <button
            key="continue"
            type="button"
            className="wizard-next"
            onClick={(event) => {
              event.preventDefault();
              move(1);
            }}
          >
            CONTINUE <span>→</span>
          </button>
        ) : (
          <button
            key="submit-agency"
            type="submit"
            className="wizard-next submit"
            data-agency-submit="true"
            onClick={(event) => {
              if (step !== steps.length - 1) {
                event.preventDefault();
                return;
              }

              explicitSubmission.current =
                event.currentTarget.form?.checkValidity() ?? false;
            }}
          >
            SUBMIT AGENCY <span>→</span>
          </button>
        )}
      </div>
    </form>
  );
}