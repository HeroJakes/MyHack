import SidebarPage from '../components/SidebarPage'

export default function MyContexts() {
  return (
    <SidebarPage
      eyebrow="Campaigns"
      title="My Campaigns"
      description="Your campaigns, events and programmes will live here. For now, this page is ready so the sidebar navigation has a proper destination."
      actionLabel="Create campaign"
      actionHref="/events/new"
    />
  )
}
