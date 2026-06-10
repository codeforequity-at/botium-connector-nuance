'use strict'

const Kind = {
  Struct: 'structValue',
  List: 'listValue',
  Number: 'numberValue',
  String: 'stringValue',
  Bool: 'boolValue',
  Null: 'nullValue'
}

const toString = Object.prototype.toString

function typeOf (value) {
  return toString.call(value)
}

function wrap (kind, value) {
  return { kind, [kind]: value }
}

function getKind (value) {
  if (value.kind) {
    return value.kind
  }
  const validKinds = Object.values(Kind)
  for (const kind of validKinds) {
    if (Object.prototype.hasOwnProperty.call(value, kind)) {
      return kind
    }
  }
  return null
}

export const list = {
  encode (values) {
    return {
      values: (values || []).map(value.encode)
    }
  },
  decode ({ values = [] }) {
    return values.map(value.decode)
  }
}

export const struct = {
  encode (json) {
    const fields = {}
    Object.keys(json).forEach(function (key) {
      if (typeof json[key] === 'undefined') return
      fields[key] = value.encode(json[key])
    })
    return { fields }
  },
  decode ({ fields = {} }) {
    const json = {}
    Object.keys(fields).forEach(function (key) {
      json[key] = value.decode(fields[key])
    })
    return json
  }
}

export const value = {
  encode (val) {
    const type = typeOf(val)
    const encoders = {
      [typeOf({})]: (v) => wrap(Kind.Struct, struct.encode(v)),
      [typeOf([])]: (v) => wrap(Kind.List, list.encode(v)),
      [typeOf(0)]: (v) => wrap(Kind.Number, v),
      [typeOf('')]: (v) => wrap(Kind.String, v),
      [typeOf(true)]: (v) => wrap(Kind.Bool, v),
      [typeOf(null)]: () => wrap(Kind.Null, 0)
    }
    const encoder = encoders[type]
    if (typeof encoder !== 'function') {
      throw new TypeError(`Unable to infer type for "${val}".`)
    }
    return encoder(val)
  },
  decode (val) {
    const kind = getKind(val)
    if (!kind) {
      throw new TypeError(`Unable to determine kind for "${val}".`)
    }
    switch (kind) {
      case 'listValue':
        return list.decode(val.listValue)
      case 'structValue':
        return struct.decode(val.structValue)
      case 'nullValue':
        return null
      default:
        return val[kind]
    }
  }
}
