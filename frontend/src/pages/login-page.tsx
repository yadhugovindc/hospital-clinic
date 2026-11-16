import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth, roleHome } from '../app/auth-context';
import { Button, ErrorNote, Field, Input } from '../components/ui';
import { getApiError } from '../lib/api';
import { useState } from 'react';
import { Eye, EyeOff, Stethoscope } from 'lucide-react';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (!loading && user) return <Navigate to={roleHome(user.role)} replace />;

  const onSubmit = async (data: LoginForm): Promise<void> => {
    setError('');
    try {
      const u = await login(data.email, data.password);
      const target = (location.state as { from?: string } | null)?.from ?? roleHome(u.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(getApiError(err).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Stethoscope className="mx-auto mb-3 text-brand-700" size={36} />
          <h1 className="text-lg font-semibold text-gray-900">Ayurvedic Clinic Management</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in with your staff account</p>
        </div>

        {error && <div className="mb-4"><ErrorNote message={error} /></div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" placeholder="you@clinic.in" {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="pr-10" {...register('password')} />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
