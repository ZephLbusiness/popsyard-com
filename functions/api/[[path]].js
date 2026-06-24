export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/', '');
  const backendUrl = 'https://shimmering-inspiration-production-d0a3.up.railway.app/api/' + path + url.search;
  const resp = await fetch(backendUrl.toString(), { method: context.request.method, headers: context.request.headers, body: ['GET','HEAD'].includes(context.request.method) ? null : context.request.body });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
}