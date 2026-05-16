import { Link } from 'react-router-dom'

type SidebarPageProps = {
  title: string
  eyebrow: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function SidebarPage({
  title,
  eyebrow,
  description,
  actionLabel,
  actionHref,
}: SidebarPageProps) {
  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-950">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          to={actionHref}
          className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
