/** ID pelabuhan GFW, mis. "idn-tarakan", "idn-kumaianchorage". Aman untuk client. */
const PORT_ID_RE = /^[a-z0-9][a-z0-9-]{1,79}$/i;

export function isValidPortId(id: string): boolean {
  return PORT_ID_RE.test(id);
}
