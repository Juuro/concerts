interface FeatureCardProps {
  icon: string
  title: string
  description: string
  iconClassName?: string
  cardClassName?: string
}

export default function FeatureCard({
  icon,
  title,
  description,
  iconClassName = "",
  cardClassName = "",
}: FeatureCardProps) {
  return (
    <div className={`card ${cardClassName}`}>
      <span className={iconClassName} role="img" aria-hidden="true">
        {icon}
      </span>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  )
}
