/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const {floor, min} = Math;

/*
Default comparison function to be used
*/
const defaultCmp = function(x, y) {
  if (x < y) { return -1; }
  if (x > y) { return 1; }
  return 0;
};

/*
Insert item x in list a, and keep it sorted assuming a is sorted.

If x is already in a, insert it to the right of the rightmost x.

Optional args lo (default 0) and hi (default a.length) bound the slice
of a to be searched.
*/
const insort = function(a, x, lo, hi, cmp) {
  if (lo == null) { lo = 0; }
  if (cmp == null) { cmp = defaultCmp; }
  if (lo < 0) { throw new Error('lo must be non-negative'); }
  if (hi == null) { hi = a.length; }
  while (lo < hi) {
    const mid = floor((lo + hi) / 2);
    if (cmp(x, a[mid]) < 0) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return a.splice(lo, lo - lo, ...[].concat(x)), x;
};

/*
Push item onto heap, maintaining the heap invariant.
*/
const heappush = function(array, item, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  array.push(item);
  return _siftdown(array, 0, array.length - 1, cmp);
};

/*
Pop the smallest item off the heap, maintaining the heap invariant.
*/
const heappop = function(array, cmp) {
  let returnitem;
  if (cmp == null) { cmp = defaultCmp; }
  const lastelt = array.pop();
  if (array.length) {
    returnitem = array[0];
    array[0] = lastelt;
    _siftup(array, 0, cmp);
  } else {
    returnitem = lastelt;
  }
  return returnitem;
};

/*
Pop and return the current smallest value, and add the new item.

This is more efficient than heappop() followed by heappush(), and can be
more appropriate when using a fixed size heap. Note that the value
returned may be larger than item! That constrains reasonable use of
this routine unless written as part of a conditional replacement:
    if item > array[0]
      item = heapreplace(array, item)
*/
const heapreplace = function(array, item, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  const returnitem = array[0];
  array[0] = item;
  _siftup(array, 0, cmp);
  return returnitem;
};

/*
Fast version of a heappush followed by a heappop.
*/
const heappushpop = function(array, item, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  if (array.length && (cmp(array[0], item) < 0)) {
    [item, array[0]] = Array.from([array[0], item]);
    _siftup(array, 0, cmp);
  }
  return item;
};

/*
Transform list into a heap, in-place, in O(array.length) time.
*/
const heapify = function(array, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  return Array.from(__range__(0, floor(array.length / 2), false).reverse()).map((i) =>
    _siftup(array, i, cmp));
};

/*
Update the position of the given item in the heap.
This function should be called every time the item is being modified.
*/
const updateItem = function(array, item, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  const pos = array.indexOf(item);
  if (pos === -1) { return; }
  _siftdown(array, 0, pos, cmp);
  return _siftup(array, pos, cmp);
};

/*
Find the n largest elements in a dataset.
*/
const nlargest = function(array, n, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  const result = array.slice(0, n);
  if (!result.length) { return result; }
  heapify(result, cmp);
  for (let elem of Array.from(array.slice(n))) { heappushpop(result, elem, cmp); }
  return result.sort(cmp).reverse();
};

/*
Find the n smallest elements in a dataset.
*/
const nsmallest = function(array, n, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  if ((n * 10) <= array.length) {
    const result = array.slice(0, n).sort(cmp);
    if (!result.length) { return result; }
    let los = result[result.length - 1];
    for (let elem of Array.from(array.slice(n))) {
      if (cmp(elem, los) < 0) {
        insort(result, elem, 0, null, cmp);
        result.pop();
        los = result[result.length - 1];
      }
    }
    return result;
  }

  heapify(array, cmp);
  return (__range__(0, min(n, array.length), false).map((i) => heappop(array, cmp)));
};

var _siftdown = function(array, startpos, pos, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  const newitem = array[pos];
  while (pos > startpos) {
    const parentpos = (pos - 1) >> 1;
    const parent = array[parentpos];
    if (cmp(newitem, parent) < 0) {
      array[pos] = parent;
      pos = parentpos;
      continue;
    }
    break;
  }
  return array[pos] = newitem;
};

var _siftup = function(array, pos, cmp) {
  if (cmp == null) { cmp = defaultCmp; }
  const endpos = array.length;
  const startpos = pos;
  const newitem = array[pos];
  let childpos = (2 * pos) + 1;
  while (childpos < endpos) {
    const rightpos = childpos + 1;
    if ((rightpos < endpos) && !(cmp(array[childpos], array[rightpos]) < 0)) {
      childpos = rightpos;
    }
    array[pos] = array[childpos];
    pos = childpos;
    childpos = (2 * pos) + 1;
  }
  array[pos] = newitem;
  return _siftdown(array, startpos, pos, cmp);
};

class Heap {
  static initClass() {
    this.push = heappush;
    this.pop = heappop;
    this.replace = heapreplace;
    this.pushpop = heappushpop;
    this.heapify = heapify;
    this.updateItem = updateItem;
    this.nlargest = nlargest;
    this.nsmallest = nsmallest;

    // aliases
    this.prototype.insert = this.prototype.push;
    this.prototype.top =    this.prototype.peek;
    this.prototype.front =  this.prototype.peek;
    this.prototype.has =    this.prototype.contains;
    this.prototype.copy =   this.prototype.clone;
  }

  constructor(cmp) {
    if (cmp == null) { cmp = defaultCmp; }
    this.cmp = cmp;
    this.nodes = [];
  }

  push(x) {
    return heappush(this.nodes, x, this.cmp);
  }

  pop() {
    return heappop(this.nodes, this.cmp);
  }

  peek() {
    return this.nodes[0];
  }

  contains(x) {
    return this.nodes.indexOf(x) !== -1;
  }

  replace(x) {
    return heapreplace(this.nodes, x, this.cmp);
  }

  pushpop(x) {
    return heappushpop(this.nodes, x, this.cmp);
  }

  heapify() {
    return heapify(this.nodes, this.cmp);
  }

  updateItem(x) {
    return updateItem(this.nodes, x, this.cmp);
  }

  clear() {
    return this.nodes = [];
  }

  empty() {
    return this.nodes.length === 0;
  }

  size() {
    return this.nodes.length;
  }

  clone() {
    const heap = new Heap();
    heap.nodes = this.nodes.slice(0);
    return heap;
  }

  toArray() {
    return this.nodes.slice(0);
  }
}
Heap.initClass();


export default Heap;

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
