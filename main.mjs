import MagiFile from './magifile.mjs';
import Madomagi from './madomagi.mjs';

const {
  MADOMAGI_ORIGIN,
  MADOMAGI_PATH,
} = Bun.env;

class Soul extends Error {
  constructor(cause) {
    super(`do not throw ${cause.name}`, { cause });
    this.name = this.constructor.name;
  }
}

const dl = async ($, { madomagi }) => {
  $ = `asset_${$}.json`;
  const response = await fetch(new URL(`${MADOMAGI_PATH}${$}.gz`, MADOMAGI_ORIGIN), {
    headers: new Headers({ 'If-None-Match': madomagi.getEtag($) }),
  });

  if (response.status === 304) return madomagi.clear();
  if (!response.ok) throw response.status;

  madomagi.updateEtag($, response.headers.get('ETag'));

  return response.json()
    .then($ =>
      Promise.all($
        .filter($ => madomagi.filter($))
        .map($ => new MagiFile($).download())
      ))
    .then($ => madomagi.update($));
};

const madomagi = new Madomagi('madomagi.db');

await dl('char_list', { madomagi }).catch(gem => {
  madomagi.clear();
  throw new Soul(gem);
}).finally(() => madomagi.close());
