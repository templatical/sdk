interface Env {
  SHARES_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;

  if (!id || !/^[a-zA-Z0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "Invalid share ID" }, { status: 400 });
  }

  const value = await context.env.SHARES_KV.get(`share:${id}`);
  if (!value) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }

  const data = JSON.parse(value) as {
    content: unknown;
    createdAt: string;
  };

  return Response.json({
    id,
    content: data.content,
    createdAt: data.createdAt,
  });
};
