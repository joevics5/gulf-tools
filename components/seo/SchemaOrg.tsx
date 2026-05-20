export function SchemaOrg({ schema }: { schema?: object | object[] }) {
  if (!schema) return null

  const schemas = Array.isArray(schema) ? schema : [schema]

  return (
    <>
      {schemas
        .filter(Boolean)
        .map((s, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(s),
            }}
          />
        ))}
    </>
  )
}