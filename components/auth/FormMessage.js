export default function FormMessage({ error, success }) {
  if (!error && !success) return null;
  return (
    <div className={`form-message ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'} tabIndex="-1">
      {error || success}
    </div>
  );
}
