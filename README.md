# DynamicImportRetryPlugin

a webpack plugin stands for rewrite built-in function which loads dynamic chucks and providing retry.

## Usage

```js
const DynamicImportRetryPlugin = require('dynamic-import-retry-plugin')

new DynamicImportRetryPlugin({
  cdns: ['//your.cdn/'],
})
```
