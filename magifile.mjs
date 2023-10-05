import { equal } from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const {
  MADOMAGI_ORIGIN,
  MADOMAGI_PATH,
} = Bun.env;

export default class MagiFile {
  static#srcDir = new URL(`${MADOMAGI_PATH}resource/`, MADOMAGI_ORIGIN);
  static#dstDir = new URL('resource/', import.meta.url);

  constructor({ file_list, md5, path }) {
    Object.assign(this, {
      file_list,
      md5,
      path,
      size: file_list.reduce(($, { size }) => $ + size, 0),
      localURL: new URL(path, this.constructor.#dstDir),
    });
  }

  #validateMD5($, _ = Infinity) {
    if (_ <= 1) return;
    _ = new Bun.CryptoHasher('md5');
    $.forEach($ => _.update($));
    equal(_.digest('hex'), this.md5, 'md5 mismatch');
  }

  #makeBlob($) {
    return new Blob(this.localURL.pathname.endsWith('.png')
      ? $.map($ => Uint8Array.from(new Uint8Array($), $ => $ ^ 0b10111101))
      : $
    );
  }

  async remoteBlob(validate = Infinity) {
    return Promise.all(this.file_list.map(async ({ size, url }) => {
      const $ = await fetch(new URL(url, this.constructor.#srcDir)).then($ => $.arrayBuffer());
      validate > 0 && equal($.byteLength, size, 'size mismatch');
      return $;
    })).then($ => this.#validateMD5($, validate) ?? this.#makeBlob($));
  }

  async localBlob(validate = Infinity) {
    const $ = Bun.file(this.localURL);
    validate > 0 && equal($.size, this.size, 'size mismatch');
    return this.#validateMD5([$], validate) ?? $;
  }

  async writeBlob($) {
    return await mkdir(new URL('.', this.localURL), { recursive: true }), Bun.write(this.localURL, $);
  }

  async download() {
    return await this.remoteBlob().then($ => this.writeBlob($)), this;
  }
}
