import { SupabaseIcon } from '~/components';

import { useLocalize } from '~/hooks';

import { TStartupConfig } from 'librechat-data-provider';

import SupabaseButton from './SupabaseButton';
import { createClient } from '@supabase/supabase-js';

function SupabaseLoginRender({
  startupConfig,
}: {
  startupConfig: TStartupConfig | null | undefined;
}) {
  const localize = useLocalize();


  console.log('SupabaseLoginRender - startupConfig:', startupConfig);
  console.log('SupabaseLoginRender - socialLoginEnabled:', startupConfig?.socialLoginEnabled);
  console.log('SupabaseLoginRender - emailLoginEnabled:', startupConfig?.emailLoginEnabled);
  console.log('SupabaseLoginRender - supabaseLoginEnabled:', startupConfig?.supabaseLoginEnabled);

  if (!startupConfig) {
    console.log('SupabaseLoginRender - No startupConfig, returning null');
    return null;
  }

  const supabaseClient = createClient(
    startupConfig?.supabaseLoginUrl || '',
    startupConfig?.supabaseKey || ''
  );

  const handleClick = async () => {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('OAuth login error:', error);
    } else if (data?.url) {
      window.location.href = data.url;
    } else {
      console.error('Unexpected response from OAuth login:', data);
    }
  }

  const providerComponents = {
    supabaseLoginButton: startupConfig.supabaseLoginEnabled && (
      // Supabase login button
      <SupabaseButton
        id="supabaseLoginButton"
        enabled={startupConfig.supabaseLoginEnabled}
        href={process.env.SUPABASE_URL}
        Icon={SupabaseIcon}
        label={localize('com_auth_supabase_login')}
        onClick={() => {
          console.log('SupabaseLoginRender - supabaseLoginButton clicked');
          handleClick();
        }}
      />
    ),
  };

  console.log('SupabaseLoginRender - providerComponents:', providerComponents);

  const shouldRender = startupConfig.socialLoginEnabled;
  console.log('SupabaseLoginRender - shouldRender:', shouldRender);

  return (
    shouldRender && (
      <>
        {startupConfig.emailLoginEnabled && (
          <>
            <div className="relative mt-6 flex w-full items-center justify-center border border-t border-gray-300 uppercase dark:border-gray-600">
              <div className="absolute bg-white px-3 text-xs text-black dark:bg-gray-900 dark:text-white">
                Or
              </div>
            </div>
            <div className="mt-8" />
          </>
        )}
        <div className="mt-2">
          {providerComponents['supabaseLoginButton']}
        </div>
      </>
    )
  );
}

export default SupabaseLoginRender;
