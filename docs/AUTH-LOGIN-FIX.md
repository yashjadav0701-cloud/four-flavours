# Four Flavours — Authentication error recovery

## What the browser error means

`Invalid login credentials` is returned by Supabase Auth before the app checks the `admin` role. It means the email/password was not accepted by the Supabase project configured in `js/config.js`. Assigning an admin role does not fix a wrong password.

## Recover access

1. Open `admin.html` and select **Forgot password?**.
2. Enter the exact administrator email address and request a reset link.
3. Open the email sent by Supabase. Check spam/junk if it is missing.
4. Open the link in the same browser and set a new password of at least 10 characters.
5. Sign in with the new password.

If no email arrives, open the Supabase Dashboard for the project whose URL is set in `js/config.js` (current project reference: `hcvdmqxvgnandynshmgz`) and check **Authentication → Users**. Confirm that the exact email exists and is not deleted/disabled, check its email-confirmation status, and review the project's SMTP/email delivery configuration. For account privacy, the reset endpoint can return a success response even when no matching user exists.

## Required redirect allowlist

In that same Supabase project, open **Authentication → URL Configuration** and add the exact redirect URL shown by the recovery form. With the current Live Server example, it is:

`http://127.0.0.1:5500/admin.html?recovery=1`

If Live Server uses another host/port, use the exact URL shown by the form. When deployed, add the corresponding production admin recovery URL too (for example `https://YOUR-VERCEL-DOMAIN/admin?recovery=1`). Do not replace the configured project URL with another project's URL unless you have verified that it holds this website's real data and Auth users.

## If sign-in works but admin access is denied

That is a separate stage: the signed-in Auth user's UUID must have `role = 'admin'` in `public.user_roles`. Follow `SUPABASE-SETUP-GUIDE.md` only after authentication succeeds. Never expose a service-role/secret key in this website.


## Expected browser 400 during a failed password attempt

When Supabase Auth receives an incorrect email/password, its password-token endpoint may return HTTP 400 with `Invalid login credentials`. That is an expected authentication rejection, not a JavaScript crash. It will continue until the correct password is used or the account is reset in the exact configured Supabase project. The client cannot securely bypass this response. Use **Forgot password?**, verify the Auth user exists in the project reference shown in `js/config.js`, and confirm email delivery/redirect allowlisting. Do not remove the role check or hardcode a password to silence the error.
