"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword } from "./actions";

function PasswordField({ name, label, placeholder, current = false }: { name: string; label: string; placeholder: string; current?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="ap-security-field"><label htmlFor={`ap-${name}`}>{label}</label><div className="ap-security-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><input id={`ap-${name}`} name={name} type={visible ? "text" : "password"} autoComplete={current ? "current-password" : "new-password"} placeholder={placeholder} minLength={current ? undefined : 12} maxLength={current ? undefined : 128} required/><button type="button" onClick={() => setVisible(value => !value)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button></div></div>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="ap-security-submit" type="submit" disabled={pending}>{pending ? "Updating your password…" : "Save my private password"}<span aria-hidden="true">→</span></button>;
}

export default function PasswordForm({ required }: { required: boolean }) {
  return <form action={changePassword} className="ap-security-form"><PasswordField name="current_password" label={required ? "Current or temporary password" : "Current password"} placeholder={required ? "Enter the password you signed in with" : "Enter your current password"} current/><PasswordField name="password" label="New password" placeholder="Choose a private password"/><PasswordField name="confirmation" label="Confirm new password" placeholder="Enter your new password again"/><p className="ap-security-password-note">Use 12–128 characters. A long, unique passphrase works well.</p><SubmitButton/><p className="ap-security-session-note">After saving, sign in again with your new password.</p></form>;
}
