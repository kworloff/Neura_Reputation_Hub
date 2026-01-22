export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">404</h2>
        <p className="text-xl mb-4">This page could not be found.</p>
        <a
          href="/"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg inline-block"
        >
          Go back home
        </a>
      </div>
    </div>
  )
}
