cookies: {
  getAll() {
    return request.cookies.getAll()
  },

  setAll(
    cookiesToSet: {
      name: string
      value: string
      options?: {
        path?: string
        domain?: string
        maxAge?: number
        expires?: Date
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'lax' | 'strict' | 'none'
      }
    }[]
  ) {
    cookiesToSet.forEach(({ name, value, options }) => {
      request.cookies.set({
        name,
        value,
        ...options,
      })

      response.cookies.set({
        name,
        value,
        ...options,
      })
    })
  },
},
