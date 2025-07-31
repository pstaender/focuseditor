/*
 * Source: https://github.com/qiao/difflib.js/tree/master/src
 */

 /*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

/*
Module difflib -- helpers for computing deltas between objects.

Function getCloseMatches(word, possibilities, n=3, cutoff=0.6):
    Use SequenceMatcher to return list of the best "good enough" matches.

Function contextDiff(a, b):
    For two lists of strings, return a delta in context diff format.

Function ndiff(a, b):
    Return a delta: the difference between `a` and `b` (lists of strings).

Function restore(delta, which):
    Return one of the two sequences that generated an ndiff delta.

Function unifiedDiff(a, b):
    For two lists of strings, return a delta in unified diff format.

Class SequenceMatcher:
    A flexible class for comparing pairs of sequences of any type.

Class Differ:
    For producing human-readable deltas from sequences of lines of text.
*/

// Requires
const {floor, max, min} = Math;
import Heap from './Heap.mjs';

// Helper functions
const _calculateRatio = function(matches, length) {
  if (length) { return ((2.0 * matches) / length); } else { return 1.0; }
};

const _arrayCmp = function(a, b) {
  const [la, lb] = Array.from([a.length, b.length]);
  for (let i = 0, end = min(la, lb), asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
    if (a[i] < b[i]) { return -1; }
    if (a[i] > b[i]) { return 1; }
  }
  return la - lb;
};

const _has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const _any = function(items) {
  for (let item of Array.from(items)) {
    if (item) { return true; }
  }
  return false;
};

export class SequenceMatcher {
  /*
  SequenceMatcher is a flexible class for comparing pairs of sequences of
  any type, so long as the sequence elements are hashable.  The basic
  algorithm predates, and is a little fancier than, an algorithm
  published in the late 1980's by Ratcliff and Obershelp under the
  hyperbolic name "gestalt pattern matching".  The basic idea is to find
  the longest contiguous matching subsequence that contains no "junk"
  elements (R-O doesn't address junk).  The same idea is then applied
  recursively to the pieces of the sequences to the left and to the right
  of the matching subsequence.  This does not yield minimal edit
  sequences, but does tend to yield matches that "look right" to people.

  SequenceMatcher tries to compute a "human-friendly diff" between two
  sequences.  Unlike e.g. UNIX(tm) diff, the fundamental notion is the
  longest *contiguous* & junk-free matching subsequence.  That's what
  catches peoples' eyes.  The Windows(tm) windiff has another interesting
  notion, pairing up elements that appear uniquely in each sequence.
  That, and the method here, appear to yield more intuitive difference
  reports than does diff.  This method appears to be the least vulnerable
  to synching up on blocks of "junk lines", though (like blank lines in
  ordinary text files, or maybe "<P>" lines in HTML files).  That may be
  because this is the only method of the 3 that has a *concept* of
  "junk" <wink>.

  Example, comparing two strings, and considering blanks to be "junk":

  >>> isjunk = (c) -> c is ' '
  >>> s = new SequenceMatcher(isjunk,
                              'private Thread currentThread;',
                              'private volatile Thread currentThread;')

  .ratio() returns a float in [0, 1], measuring the "similarity" of the
  sequences.  As a rule of thumb, a .ratio() value over 0.6 means the
  sequences are close matches:

  >>> s.ratio().toPrecision(3)
  '0.866'

  If you're only interested in where the sequences match,
  .getMatchingBlocks() is handy:

  >>> for [a, b, size] in s.getMatchingBlocks()
  ...   console.log("a[#{a}] and b[#{b}] match for #{size} elements");
  a[0] and b[0] match for 8 elements
  a[8] and b[17] match for 21 elements
  a[29] and b[38] match for 0 elements

  Note that the last tuple returned by .get_matching_blocks() is always a
  dummy, (len(a), len(b), 0), and this is the only case in which the last
  tuple element (number of elements matched) is 0.

  If you want to know how to change the first sequence into the second,
  use .get_opcodes():

  >>> for [op, a1, a2, b1, b2] in s.getOpcodes()
  ...   console.log "#{op} a[#{a1}:#{a2}] b[#{b1}:#{b2}]"
  equal a[0:8] b[0:8]
  insert a[8:8] b[8:17]
  equal a[8:29] b[17:38]

  See the Differ class for a fancy human-friendly file differencer, which
  uses SequenceMatcher both to compare sequences of lines, and to compare
  sequences of characters within similar (near-matching) lines.

  See also function getCloseMatches() in this module, which shows how
  simple code building on SequenceMatcher can be used to do useful work.

  Timing:  Basic R-O is cubic time worst case and quadratic time expected
  case.  SequenceMatcher is quadratic time for the worst case and has
  expected-case behavior dependent in a complicated way on how many
  elements the sequences have in common; best case time is linear.

  Methods:

  constructor(isjunk=null, a='', b='')
      Construct a SequenceMatcher.

  setSeqs(a, b)
      Set the two sequences to be compared.

  setSeq1(a)
      Set the first sequence to be compared.

  setSeq2(b)
      Set the second sequence to be compared.

  findLongestMatch(alo, ahi, blo, bhi)
      Find longest matching block in a[alo:ahi] and b[blo:bhi].

  getMatchingBlocks()
      Return list of triples describing matching subsequences.

  getOpcodes()
      Return list of 5-tuples describing how to turn a into b.

  ratio()
      Return a measure of the sequences' similarity (float in [0,1]).

  quickRatio()
      Return an upper bound on .ratio() relatively quickly.

  realQuickRatio()
      Return an upper bound on ratio() very quickly.
  */
  constructor(isjunk, a, b, autojunk) {
    this.isjunk = isjunk;
    if (a == null) { a = ''; }
    if (b == null) { b = ''; }
    if (autojunk == null) { autojunk = true; }
    this.autojunk = autojunk;
    /*
    Construct a SequenceMatcher.

    Optional arg isjunk is null (the default), or a one-argument
    function that takes a sequence element and returns true iff the
    element is junk.  Null is equivalent to passing "(x) -> 0", i.e.
    no elements are considered to be junk.  For example, pass
        (x) -> x in ' \t'
    if you're comparing lines as sequences of characters, and don't
    want to synch up on blanks or hard tabs.

    Optional arg a is the first of two sequences to be compared.  By
    default, an empty string.  The elements of a must be hashable.  See
    also .setSeqs() and .setSeq1().

    Optional arg b is the second of two sequences to be compared.  By
    default, an empty string.  The elements of b must be hashable. See
    also .setSeqs() and .setSeq2().

    Optional arg autojunk should be set to false to disable the
    "automatic junk heuristic" that treats popular elements as junk
    (see module documentation for more information).
    */

    // Members:
    // a
    //      first sequence
    // b
    //      second sequence; differences are computed as "what do
    //      we need to do to 'a' to change it into 'b'?"
    // b2j
    //      for x in b, b2j[x] is a list of the indices (into b)
    //      at which x appears; junk elements do not appear
    // fullbcount
    //      for x in b, fullbcount[x] == the number of times x
    //      appears in b; only materialized if really needed (used
    //      only for computing quickRatio())
    // matchingBlocks
    //      a list of [i, j, k] triples, where a[i...i+k] == b[j...j+k];
    //      ascending & non-overlapping in i and in j; terminated by
    //      a dummy (len(a), len(b), 0) sentinel
    // opcodes
    //      a list of [tag, i1, i2, j1, j2] tuples, where tag is
    //      one of
    //          'replace'   a[i1...i2] should be replaced by b[j1...j2]
    //          'delete'    a[i1...i2] should be deleted
    //          'insert'    b[j1...j2] should be inserted
    //          'equal'     a[i1...i2] == b[j1...j2]
    // isjunk
    //      a user-supplied function taking a sequence element and
    //      returning true iff the element is "junk" -- this has
    //      subtle but helpful effects on the algorithm, which I'll
    //      get around to writing up someday <0.9 wink>.
    //      DON'T USE!  Only __chainB uses this.  Use isbjunk.
    // isbjunk
    //      for x in b, isbjunk(x) == isjunk(x) but much faster;
    //      DOES NOT WORK for x in a!
    // isbpopular
    //      for x in b, isbpopular(x) is true iff b is reasonably long
    //      (at least 200 elements) and x accounts for more than 1 + 1% of
    //      its elements (when autojunk is enabled).
    //      DOES NOT WORK for x in a!
    this.a = (this.b = null);
    this.setSeqs(a, b);
  }

  setSeqs(a, b) {
    /*
    Set the two sequences to be compared.

    >>> s = new SequenceMatcher()
    >>> s.setSeqs('abcd', 'bcde')
    >>> s.ratio()
    0.75
    */
    this.setSeq1(a);
    return this.setSeq2(b);
  }

  setSeq1(a) {
    /*
    Set the first sequence to be compared.

    The second sequence to be compared is not changed.

    >>> s = new SequenceMatcher(null, 'abcd', 'bcde')
    >>> s.ratio()
    0.75
    >>> s.setSeq1('bcde')
    >>> s.ratio()
    1.0

    SequenceMatcher computes and caches detailed information about the
    second sequence, so if you want to compare one sequence S against
    many sequences, use .setSeq2(S) once and call .setSeq1(x)
    repeatedly for each of the other sequences.

    See also setSeqs() and setSeq2().
    */
    if (a === this.a) { return; }
    this.a = a;
    return this.matchingBlocks = (this.opcodes = null);
  }


  setSeq2(b) {
    /*
    Set the second sequence to be compared.

    The first sequence to be compared is not changed.

    >>> s = new SequenceMatcher(null, 'abcd', 'bcde')
    >>> s.ratio()
    0.75
    >>> s.setSeq2('abcd')
    >>> s.ratio()
    1.0

    SequenceMatcher computes and caches detailed information about the
    second sequence, so if you want to compare one sequence S against
    many sequences, use .setSeq2(S) once and call .setSeq1(x)
    repeatedly for each of the other sequences.

    See also setSeqs() and setSeq1().
    */
    if (b === this.b) { return; }
    this.b = b;
    this.matchingBlocks = (this.opcodes = null);
    this.fullbcount = null;
    return this._chainB();
  }

  // For each element x in b, set b2j[x] to a list of the indices in
  // b where x appears; the indices are in increasing order; note that
  // the number of times x appears in b is b2j[x].length ...
  // when @isjunk is defined, junk elements don't show up in this
  // map at all, which stops the central findLongestMatch method
  // from starting any matching block at a junk element ...
  // also creates the fast isbjunk function ...
  // b2j also does not contain entries for "popular" elements, meaning
  // elements that account for more than 1 + 1% of the total elements, and
  // when the sequence is reasonably large (>= 200 elements); this can
  // be viewed as an adaptive notion of semi-junk, and yields an enormous
  // speedup when, e.g., comparing program files with hundreds of
  // instances of "return null;" ...
  // note that this is only called when b changes; so for cross-product
  // kinds of matches, it's best to call setSeq2 once, then setSeq1
  // repeatedly

  _chainB() {
    // Because isjunk is a user-defined function, and we test
    // for junk a LOT, it's important to minimize the number of calls.
    // Before the tricks described here, __chainB was by far the most
    // time-consuming routine in the whole module!  If anyone sees
    // Jim Roskind, thank him again for profile.py -- I never would
    // have guessed that.
    // The first trick is to build b2j ignoring the possibility
    // of junk.  I.e., we don't call isjunk at all yet.  Throwing
    // out the junk later is much cheaper than building b2j "right"
    // from the start.
    let b2j, elt;
    const {
      b
    } = this;
    this.b2j = (b2j = {});

    for (let i = 0; i < b.length; i++) {
      elt = b[i];
      const indices = _has(b2j, elt) ? b2j[elt] : (b2j[elt] = []);
      indices.push(i);
    }

    // Purge junk elements
    const junk = {};
    const {
      isjunk
    } = this;
    if (isjunk) {
      for (elt of Array.from(Object.keys(b2j))) {
        if (isjunk(elt)) {
          junk[elt] = true;
          delete b2j[elt];
        }
      }
    }

    // Purge popular elements that are not junk
    const popular = {};
    const n = b.length;
    if (this.autojunk && (n >= 200)) {
      const ntest = floor(n / 100) + 1;
      for (elt in b2j) {
        const idxs = b2j[elt];
        if (idxs.length > ntest) {
          popular[elt] = true;
          delete b2j[elt];
        }
      }
    }

    // Now for x in b, isjunk(x) == x in junk, but the latter is much faster.
    // Sicne the number of *unique* junk elements is probably small, the
    // memory burden of keeping this set alive is likely trivial compared to
    // the size of b2j.
    this.isbjunk = b => _has(junk, b);
    return this.isbpopular = b => _has(popular, b);
  }

  findLongestMatch(alo, ahi, blo, bhi) {
    /*
    Find longest matching block in a[alo...ahi] and b[blo...bhi].

    If isjunk is not defined:

    Return [i,j,k] such that a[i...i+k] is equal to b[j...j+k], where
        alo <= i <= i+k <= ahi
        blo <= j <= j+k <= bhi
    and for all [i',j',k'] meeting those conditions,
        k >= k'
        i <= i'
        and if i == i', j <= j'

    In other words, of all maximal matching blocks, return one that
    starts earliest in a, and of all those maximal matching blocks that
    start earliest in a, return the one that starts earliest in b.

    >>> isjunk = (x) -> x is ' '
    >>> s = new SequenceMatcher(isjunk, ' abcd', 'abcd abcd')
    >>> s.findLongestMatch(0, 5, 0, 9)
    [1, 0, 4]

    >>> s = new SequenceMatcher(null, 'ab', 'c')
    >>> s.findLongestMatch(0, 2, 0, 1)
    [0, 0, 0]
    */

    // CAUTION:  stripping common prefix or suffix would be incorrect.
    // E.g.,
    //    ab
    //    acab
    // Longest matching block is "ab", but if common prefix is
    // stripped, it's "a" (tied with "b").  UNIX(tm) diff does so
    // strip, so ends up claiming that ab is changed to acab by
    // inserting "ca" in the middle.  That's minimal but unintuitive:
    // "it's obvious" that someone inserted "ac" at the front.
    // Windiff ends up at the same place as diff, but by pairing up
    // the unique 'b's and then matching the first two 'a's.

    const [a, b, b2j, isbjunk] = Array.from([this.a, this.b, this.b2j, this.isbjunk]);
    let [besti, bestj, bestsize] = Array.from([alo, blo, 0]);

    // find longest junk-free match
    // during an iteration of the loop, j2len[j] = length of longest
    // junk-free match ending with a[i-1] and b[j]
    let j2len = {};
    for (let i = alo, end = ahi, asc = alo <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      // look at all instances of a[i] in b; note that because
      // b2j has no junk keys, the loop is skipped if a[i] is junk
      const newj2len = {};
      for (let j of Array.from((_has(b2j, a[i]) ? b2j[a[i]] : []))) {
        // a[i] matches b[j]
        if (j < blo) { continue; }
        if (j >= bhi) { break; }
        const k = (newj2len[j] = (j2len[j-1] || 0) + 1);
        if (k > bestsize) {
          [besti, bestj, bestsize] = Array.from([(i-k)+1,(j-k)+1,k]);
        }
      }
      j2len = newj2len;
    }

    // Extend the best by non-junk elements on each end.  In particular,
    // "popular" non-junk elements aren't in b2j, which greatly speeds
    // the inner loop above, but also means "the best" match so far
    // doesn't contain any junk *or* popular non-junk elements.
    while ((besti > alo) && (bestj > blo) &&
        !isbjunk(b[bestj-1]) &&
        (a[besti-1] === b[bestj-1])) {
      [besti, bestj, bestsize] = Array.from([besti-1, bestj-1, bestsize+1]);
    }
    while (((besti+bestsize) < ahi) && ((bestj+bestsize) < bhi) &&
        !isbjunk(b[bestj+bestsize]) &&
        (a[besti+bestsize] === b[bestj+bestsize])) {
      bestsize++;
    }

    // Now that we have a wholly interesting match (albeit possibly
    // empty!), we may as well suck up the matching junk on each
    // side of it too.  Can't think of a good reason not to, and it
    // saves post-processing the (possibly considerable) expense of
    // figuring out what to do with it.  In the case of an empty
    // interesting match, this is clearly the right thing to do,
    // because no other kind of match is possible in the regions.
    while ((besti > alo) && (bestj > blo) &&
        isbjunk(b[bestj-1]) &&
        (a[besti-1] === b[bestj-1])) {
      [besti,bestj,bestsize] = Array.from([besti-1, bestj-1, bestsize+1]);
    }
    while (((besti+bestsize) < ahi) && ((bestj+bestsize) < bhi) &&
        isbjunk(b[bestj+bestsize]) &&
        (a[besti+bestsize] === b[bestj+bestsize])) {
      bestsize++;
    }

    return [besti, bestj, bestsize];
  }

  getMatchingBlocks() {
    /*
    Return list of triples describing matching subsequences.

    Each triple is of the form [i, j, n], and means that
    a[i...i+n] == b[j...j+n].  The triples are monotonically increasing in
    i and in j.  it's also guaranteed that if
    [i, j, n] and [i', j', n'] are adjacent triples in the list, and
    the second is not the last triple in the list, then i+n != i' or
    j+n != j'.  IOW, adjacent triples never describe adjacent equal
    blocks.

    The last triple is a dummy, [a.length, b.length, 0], and is the only
    triple with n==0.

    >>> s = new SequenceMatcher(null, 'abxcd', 'abcd')
    >>> s.getMatchingBlocks()
    [[0, 0, 2], [3, 2, 2], [5, 4, 0]]

    */
    let j1, k1;
    if (this.matchingBlocks) { return this.matchingBlocks; }
    const [la, lb] = Array.from([this.a.length, this.b.length]);

    // This is most naturally expressed as a recursive algorithm, but
    // at least one user bumped into extreme use cases that exceeded
    // the recursion limit on their box.  So, now we maintain a list
    // ('queue`) of blocks we still need to look at, and append partial
    // results to `matching_blocks` in a loop; the matches are sorted
    // at the end.
    const queue = [[0, la, 0, lb]];
    const matchingBlocks = [];
    while (queue.length) {
      var x;
      const [alo, ahi, blo, bhi] = Array.from(queue.pop());
      const [i, j, k] = Array.from((x = this.findLongestMatch(alo, ahi, blo, bhi)));
      // a[alo...i] vs b[blo...j] unknown
      // a[i...i+k] same as b[j...j+k]
      // a[i+k...ahi] vs b[j+k...bhi] unknown
      if (k) {
        matchingBlocks.push(x);
        if ((alo < i) && (blo < j)) {
          queue.push([alo, i, blo, j]);
        }
        if (((i+k) < ahi) && ((j+k) < bhi)) {
          queue.push([i+k, ahi, j+k, bhi]);
        }
      }
    }
    matchingBlocks.sort(_arrayCmp);

    // It's possible that we have adjacent equal blocks in the
    // matching_blocks list now.
    let i1 = (j1 = (k1 = 0));
    const nonAdjacent = [];
    for (let [i2, j2, k2] of Array.from(matchingBlocks)) {
      // Is this block adjacent to i1, j1, k1?
      if (((i1 + k1) === i2) && ((j1 + k1) === j2)) {
        // Yes, so collapse them -- this just increases the length of
        // the first block by the length of the second, and the first
        // block so lengthened remains the block to compare against.
        k1 += k2;
      } else {
        // Not adjacent.  Remember the first block (k1==0 means it's
        // the dummy we started with), and make the second block the
        // new block to compare against.
        if (k1) {
          nonAdjacent.push([i1, j1, k1]);
        }
        [i1, j1, k1] = Array.from([i2, j2, k2]);
      }
    }
    if (k1) {
      nonAdjacent.push([i1, j1, k1]);
    }

    nonAdjacent.push([la, lb, 0]);
    return this.matchingBlocks = nonAdjacent;
  }

  getOpcodes() {
    /*
    Return list of 5-tuples describing how to turn a into b.

    Each tuple is of the form [tag, i1, i2, j1, j2].  The first tuple
    has i1 == j1 == 0, and remaining tuples have i1 == the i2 from the
    tuple preceding it, and likewise for j1 == the previous j2.

    The tags are strings, with these meanings:

    'replace':  a[i1...i2] should be replaced by b[j1...j2]
    'delete':   a[i1...i2] should be deleted.
                Note that j1==j2 in this case.
    'insert':   b[j1...j2] should be inserted at a[i1...i1].
                Note that i1==i2 in this case.
    'equal':    a[i1...i2] == b[j1...j2]

    >>> s = new SequenceMatcher(null, 'qabxcd', 'abycdf')
    >>> s.getOpcodes()
    [ [ 'delete'  , 0 , 1 , 0 , 0 ] ,
      [ 'equal'   , 1 , 3 , 0 , 2 ] ,
      [ 'replace' , 3 , 4 , 2 , 3 ] ,
      [ 'equal'   , 4 , 6 , 3 , 5 ] ,
      [ 'insert'  , 6 , 6 , 5 , 6 ] ]
    */

    let answer, j;
    if (this.opcodes) { return this.opcodes; }
    let i = (j = 0);
    this.opcodes = (answer = []);
    for (let [ai, bj, size] of Array.from(this.getMatchingBlocks())) {
      // invariant:  we've pumped out correct diffs to change
      // a[0...i] into b[0...j], and the next matching block is
      // a[ai...ai+size] == b[bj...bj+size].  So we need to pump
      // out a diff to change a[i:ai] into b[j...bj], pump out
      // the matching block, and move [i,j] beyond the match
      let tag = '';
      if ((i < ai) && (j < bj)) {
        tag = 'replace';
      } else if (i < ai) {
        tag = 'delete';
      } else if (j < bj) {
        tag = 'insert';
      }
      if (tag) {
        answer.push([tag, i, ai, j, bj]);
      }
      [i, j] = Array.from([ai+size, bj+size]);

      // the list of matching blocks is terminated by a
      // sentinel with size 0
      if (size) {
        answer.push(['equal', ai, i, bj, j]);
      }
    }
    return answer;
  }

  getGroupedOpcodes(n) {
    let i1, i2, j1, j2, tag;
    if (n == null) { n = 3; }
    /*
    Isolate change clusters by eliminating ranges with no changes.

    Return a list groups with upto n lines of context.
    Each group is in the same format as returned by get_opcodes().

    >>> a = [1...40].map(String)
    >>> b = a.slice()
    >>> b[8...8] = 'i'
    >>> b[20] += 'x'
    >>> b[23...28] = []
    >>> b[30] += 'y'
    >>> s = new SequenceMatcher(null, a, b)
    >>> s.getGroupedOpcodes()
    [ [ [ 'equal'  , 5 , 8  , 5 , 8 ],
        [ 'insert' , 8 , 8  , 8 , 9 ],
        [ 'equal'  , 8 , 11 , 9 , 12 ] ],
      [ [ 'equal'   , 16 , 19 , 17 , 20 ],
        [ 'replace' , 19 , 20 , 20 , 21 ],
        [ 'equal'   , 20 , 22 , 21 , 23 ],
        [ 'delete'  , 22 , 27 , 23 , 23 ],
        [ 'equal'   , 27 , 30 , 23 , 26 ] ],
      [ [ 'equal'   , 31 , 34 , 27 , 30 ],
        [ 'replace' , 34 , 35 , 30 , 31 ],
        [ 'equal'   , 35 , 38 , 31 , 34 ] ] ]
    */
    let codes = this.getOpcodes();
    if (!codes.length) {
      codes = [['equal', 0, 1, 0, 1]];
    }
    // Fixup leading and trailing groups if they show no changes.
    if (codes[0][0] === 'equal') {
      [tag, i1, i2, j1, j2] = Array.from(codes[0]);
      codes[0] = [tag, max(i1, i2-n), i2, max(j1, j2-n), j2];
    }
    if (codes[codes.length-1][0] === 'equal') {
      [tag, i1, i2, j1, j2] = Array.from(codes[codes.length-1]);
      codes[codes.length-1] = [tag, i1, min(i2, i1+n), j1, min(j2, j1+n)];
    }

    const nn = n + n;
    const groups = [];
    let group = [];
    for ([tag, i1, i2, j1, j2] of Array.from(codes)) {
      // End the current group and start a new one whenever
      // there is a large range with no changes.
      if ((tag === 'equal') && ((i2-i1) > nn)) {
        group.push([tag, i1, min(i2, i1+n), j1, min(j2, j1+n)]);
        groups.push(group);
        group = [];
        [i1, j1] = Array.from([max(i1, i2-n), max(j1, j2-n)]);
      }
      group.push([tag, i1, i2, j1, j2]);
    }
    if (group.length && !((group.length === 1) && (group[0][0] === 'equal'))) {
      groups.push(group);
    }
    return groups;
  }

  ratio() {
    /*
    Return a measure of the sequences' similarity (float in [0,1]).

    Where T is the total number of elements in both sequences, and
    M is the number of matches, this is 2.0*M / T.
    Note that this is 1 if the sequences are identical, and 0 if
    they have nothing in common.

    .ratio() is expensive to compute if you haven't already computed
    .getMatchingBlocks() or .getOpcodes(), in which case you may
    want to try .quickRatio() or .realQuickRatio() first to get an
    upper bound.

    >>> s = new SequenceMatcher(null, 'abcd', 'bcde')
    >>> s.ratio()
    0.75
    >>> s.quickRatio()
    0.75
    >>> s.realQuickRatio()
    1.0
    */
    let matches = 0;
    for (let match of Array.from(this.getMatchingBlocks())) {
      matches += match[2];
    }
    return _calculateRatio(matches, this.a.length + this.b.length);
  }

  quickRatio() {
    /*
    Return an upper bound on ratio() relatively quickly.

    This isn't defined beyond that it is an upper bound on .ratio(), and
    is faster to compute.
    */

    // viewing a and b as multisets, set matches to the cardinality
    // of their intersection; this counts the number of matches
    // without regard to order, so is clearly an upper bound
    let elt, fullbcount;
    if (!this.fullbcount) {
      this.fullbcount = (fullbcount = {});
      for (elt of Array.from(this.b)) {
        fullbcount[elt] = (fullbcount[elt] || 0) + 1;
      }
    }

    ({
      fullbcount
    } = this);
    // avail[x] is the number of times x appears in 'b' less the
    // number of times we've seen it in 'a' so far ... kinda
    const avail = {};
    let matches = 0;
    for (elt of Array.from(this.a)) {
      var numb;
      if (_has(avail, elt)) {
        numb = avail[elt];
      } else {
        numb = fullbcount[elt] || 0;
      }
      avail[elt] = numb - 1;
      if (numb > 0) {
        matches++;
      }
    }
    return _calculateRatio(matches, this.a.length + this.b.length);
  }

  realQuickRatio() {
    /*
    Return an upper bound on ratio() very quickly.

    This isn't defined beyond that it is an upper bound on .ratio(), and
    is faster to compute than either .ratio() or .quickRatio().
    */
    const [la, lb] = Array.from([this.a.length, this.b.length]);
    // can't have more matches than the number of elements in the
    // shorter sequence
    return _calculateRatio(min(la, lb), la + lb);
  }
}

const getCloseMatches = function(word, possibilities, n, cutoff) {
  let x;
  if (n == null) { n = 3; }
  if (cutoff == null) { cutoff = 0.6; }
  /*
  Use SequenceMatcher to return list of the best "good enough" matches.

  word is a sequence for which close matches are desired (typically a
  string).

  possibilities is a list of sequences against which to match word
  (typically a list of strings).

  Optional arg n (default 3) is the maximum number of close matches to
  return.  n must be > 0.

  Optional arg cutoff (default 0.6) is a float in [0, 1].  Possibilities
  that don't score at least that similar to word are ignored.

  The best (no more than n) matches among the possibilities are returned
  in a list, sorted by similarity score, most similar first.

  >>> getCloseMatches('appel', ['ape', 'apple', 'peach', 'puppy'])
  ['apple', 'ape']
  >>> KEYWORDS = require('coffee-script').RESERVED
  >>> getCloseMatches('wheel', KEYWORDS)
  ['when', 'while']
  >>> getCloseMatches('accost', KEYWORDS)
  ['const']
  */
  if (!(n > 0)) {
    throw new Error(`n must be > 0: (${n})`);
  }
  if (!(0.0 <= cutoff && cutoff <= 1.0)) {
    throw new Error(`cutoff must be in [0.0, 1.0]: (${cutoff})`);
  }
  let result = [];
  const s = new SequenceMatcher();
  s.setSeq2(word);
  for (x of Array.from(possibilities)) {
    s.setSeq1(x);
    if ((s.realQuickRatio() >= cutoff) &&
        (s.quickRatio() >= cutoff) &&
        (s.ratio() >= cutoff)) {
      result.push([s.ratio(), x]);
    }
  }

  // Move the best scorers to head of list
  result = Heap.nlargest(result, n, _arrayCmp);
  // Strip scores for the best n matches
  return (() => {
    let score;
    const result1 = [];
    for ([score, x] of Array.from(result)) {       result1.push(x);
    }
    return result1;
  })();
};

const _countLeading = function(line, ch) {
  /*
  Return number of `ch` characters at the start of `line`.

  >>> _countLeading('   abc', ' ')
  3
  */
  let [i, n] = Array.from([0, line.length]);
  while ((i < n) && (line[i] === ch)) {
    i++;
  }
  return i;
};


export class Differ {
  /*
  Differ is a class for comparing sequences of lines of text, and
  producing human-readable differences or deltas.  Differ uses
  SequenceMatcher both to compare sequences of lines, and to compare
  sequences of characters within similar (near-matching) lines.

  Each line of a Differ delta begins with a two-letter code:

      '- '    line unique to sequence 1
      '+ '    line unique to sequence 2
      '  '    line common to both sequences
      '? '    line not present in either input sequence

  Lines beginning with '? ' attempt to guide the eye to intraline
  differences, and were not present in either input sequence.  These lines
  can be confusing if the sequences contain tab characters.

  Note that Differ makes no claim to produce a *minimal* diff.  To the
  contrary, minimal diffs are often counter-intuitive, because they synch
  up anywhere possible, sometimes accidental matches 100 pages apart.
  Restricting synch points to contiguous matches preserves some notion of
  locality, at the occasional cost of producing a longer diff.

  Example: Comparing two texts.

  >>> text1 = ['1. Beautiful is better than ugly.\n',
  ...   '2. Explicit is better than implicit.\n',
  ...   '3. Simple is better than complex.\n',
  ...   '4. Complex is better than complicated.\n']
  >>> text1.length
  4
  >>> text2 = ['1. Beautiful is better than ugly.\n',
  ...   '3.   Simple is better than complex.\n',
  ...   '4. Complicated is better than complex.\n',
  ...   '5. Flat is better than nested.\n']

  Next we instantiate a Differ object:

  >>> d = new Differ()

  Note that when instantiating a Differ object we may pass functions to
  filter out line and character 'junk'.

  Finally, we compare the two:

  >>> result = d.compare(text1, text2)
  [ '  1. Beautiful is better than ugly.\n',
    '- 2. Explicit is better than implicit.\n',
    '- 3. Simple is better than complex.\n',
    '+ 3.   Simple is better than complex.\n',
    '?   ++\n',
    '- 4. Complex is better than complicated.\n',
    '?          ^                     ---- ^\n',
    '+ 4. Complicated is better than complex.\n',
    '?         ++++ ^                      ^\n',
    '+ 5. Flat is better than nested.\n' ]

  Methods:

  constructor(linejunk=null, charjunk=null)
      Construct a text differencer, with optional filters.
  compare(a, b)
      Compare two sequences of lines; generate the resulting delta.
  */
  constructor(linejunk, charjunk) {
    /*
    Construct a text differencer, with optional filters.

    The two optional keyword parameters are for filter functions:

    - `linejunk`: A function that should accept a single string argument,
      and return true iff the string is junk. The module-level function
      `IS_LINE_JUNK` may be used to filter out lines without visible
      characters, except for at most one splat ('#').  It is recommended
      to leave linejunk null.

    - `charjunk`: A function that should accept a string of length 1. The
      module-level function `IS_CHARACTER_JUNK` may be used to filter out
      whitespace characters (a blank or tab; **note**: bad idea to include
      newline in this!).  Use of IS_CHARACTER_JUNK is recommended.
    */
    this.linejunk = linejunk;
    this.charjunk = charjunk;
  }

  compare(a, b) {
    /*
    Compare two sequences of lines; generate the resulting delta.

    Each sequence must contain individual single-line strings ending with
    newlines. Such sequences can be obtained from the `readlines()` method
    of file-like objects.  The delta generated also consists of newline-
    terminated strings, ready to be printed as-is via the writeline()
    method of a file-like object.

    Example:

    >>> d = new Differ
    >>> d.compare(['one\n', 'two\n', 'three\n'],
    ...           ['ore\n', 'tree\n', 'emu\n'])
    [ '- one\n',
      '?  ^\n',
      '+ ore\n',
      '?  ^\n',
      '- two\n',
      '- three\n',
      '?  -\n',
      '+ tree\n',
      '+ emu\n' ]
    */
    const cruncher = new SequenceMatcher(this.linejunk, a, b);
    const lines = [];
    for (let [tag, alo, ahi, blo, bhi] of Array.from(cruncher.getOpcodes())) {
      var g;
      switch (tag) {
        case 'replace':
          g = this._fancyReplace(a, alo, ahi, b, blo, bhi);
          break;
        case 'delete':
          g = this._dump('-', a, alo, ahi);
          break;
        case 'insert':
          g = this._dump('+', b, blo, bhi);
          break;
        case 'equal':
          g = this._dump(' ', a, alo, ahi);
          break;
        default:
          throw new Error(`unknow tag (${tag})`);
      }
      for (let line of Array.from(g)) { lines.push(line); }
    }
    return lines;
  }

  _dump(tag, x, lo, hi) {
    /*
    Generate comparison results for a same-tagged range.
    */
    return (__range__(lo, hi, false).map((i) => `${tag} ${x[i]}`));
  }

  _plainReplace(a, alo, ahi, b, blo, bhi) {
    let first, second;
    if (!((alo < ahi) && (blo < bhi))) {
      throw new Error('Invalid range');
    }
    // dump the shorter block first -- reduces the burden on short-term
    // memory if the blocks are of very different sizes
    if ((bhi - blo) < (ahi - alo)) {
      first  = this._dump('+', b, blo, bhi);
      second = this._dump('-', a, alo, ahi);
    } else {
      first  = this._dump('-', a, alo, ahi);
      second = this._dump('+', b, blo, bhi);
    }

    const lines = [];
    for (let g of [first, second]) { for (let line of Array.from(g)) { lines.push(line); } }
    return lines;
  }

  _fancyReplace(a, alo, ahi, b, blo, bhi) {
    /*
    When replacing one block of lines with another, search the blocks
    for *similar* lines; the best-matching pair (if any) is used as a
    synch point, and intraline difference marking is done on the
    similar pair. Lots of work, but often worth it.

    Example:
    >>> d = new Differ
    >>> d._fancyReplace(['abcDefghiJkl\n'], 0, 1,
    ...                 ['abcdefGhijkl\n'], 0, 1)
    [ '- abcDefghiJkl\n',
      '?    ^  ^  ^\n',
      '+ abcdefGhijkl\n',
      '?    ^  ^  ^\n' ]
    */

    // don't synch up unless the lines have a similarity score of at
    // least cutoff; best_ratio tracks the best score seen so far
    let besti, bestj, line;
    let [bestRatio, cutoff] = Array.from([0.74, 0.75]);
    const cruncher = new SequenceMatcher(this.charjunk);
    let [eqi, eqj] = Array.from([null, null]); // 1st indices of equal lines (if any)
    const lines = [];

    // search for the pair that matches best without being identical
    // (identical lines must be junk lines, & we don't want to synch up
    // on junk -- unless we have to)
    for (let j = blo, end = bhi, asc = blo <= end; asc ? j < end : j > end; asc ? j++ : j--) {
      const bj = b[j];
      cruncher.setSeq2(bj);
      for (let i = alo, end1 = ahi, asc1 = alo <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) {
        const ai = a[i];
        if (ai === bj) {
          if (eqi === null) {
            [eqi, eqj] = Array.from([i, j]);
          }
          continue;
        }
        cruncher.setSeq1(ai);

        // computing similarity is expensive, so use the quick
        // upper bounds first -- have seen this speed up messy
        // compares by a factor of 3.
        // note that ratio() is only expensive to compute the first
        // time it's called on a sequence pair; the expensive part
        // of the computation is cached by cruncher
        if ((cruncher.realQuickRatio() > bestRatio) &&
            (cruncher.quickRatio() > bestRatio) &&
            (cruncher.ratio() > bestRatio)) {
          [bestRatio, besti, bestj] = Array.from([cruncher.ratio(), i, j]);
        }
      }
    }

    if (bestRatio < cutoff) {
      // no non-identical "pretty close" pair
      if (eqi === null) {
        // no identical pair either -- treat it as a straight replace
        for (line of Array.from(this._plainReplace(a, alo, ahi, b, blo, bhi))) {
          lines.push(line);
        }
        return lines;
      }
      // no close pair, but an identical pair -- synch up on that
      [besti, bestj, bestRatio] = Array.from([eqi, eqj, 1.0]);
    } else {
      // there's a close pair, so forget the identical pair (if any)
      eqi = null;
    }

    // a[besti] very similar to b[bestj]; eqi is null iff they're not
    // identical

    // pump out diffs from before the synch point
    for (line of Array.from(this._fancyHelper(a, alo, besti, b, blo, bestj))) {
      lines.push(line);
    }

    // do intraline marking on the synch pair
    const [aelt, belt] = Array.from([a[besti], b[bestj]]);
    if (eqi === null) {
      // pump out a '-', '?', '+', '?' quad for the synched lines
      let btags;
      let atags = (btags = '');
      cruncher.setSeqs(aelt, belt);
      for (let [tag, ai1, ai2, bj1, bj2] of Array.from(cruncher.getOpcodes())) {
        const [la, lb] = Array.from([ai2 - ai1, bj2 - bj1]);
        switch (tag) {
          case 'replace':
            atags += Array(la+1).join('^');
            btags += Array(lb+1).join('^');
            break;
          case 'delete':
            atags += Array(la+1).join('-');
            break;
          case 'insert':
            btags += Array(lb+1).join('+');
            break;
          case 'equal':
            atags += Array(la+1).join(' ');
            btags += Array(lb+1).join(' ');
            break;
          default:
            throw new Error(`unknow tag (${tag})`);
        }
      }
      for (line of Array.from(this._qformat(aelt, belt, atags, btags))) {
        lines.push(line);
      }
    } else {
      // the synch pair is identical
      lines.push('  ' + aelt);
    }

    // pump out diffs from after the synch point
    for (line of Array.from(this._fancyHelper(a, besti+1, ahi, b, bestj+1, bhi))) {
      lines.push(line);
    }

    return lines;
  }

  _fancyHelper(a, alo, ahi, b, blo, bhi) {
    let g = [];
    if (alo < ahi) {
      if (blo < bhi) {
        g = this._fancyReplace(a, alo, ahi, b, blo, bhi);
      } else {
        g = this._dump('-', a, alo, ahi);
      }
    } else if (blo < bhi) {
      g = this._dump('+', b, blo, bhi);
    }
    return g;
  }

  _qformat(aline, bline, atags, btags) {
    /*
    Format "?" output and deal with leading tabs.

    Example:

    >>> d = new Differ
    >>> d._qformat('\tabcDefghiJkl\n', '\tabcdefGhijkl\n',
    [ '- \tabcDefghiJkl\n',
      '? \t ^ ^  ^\n',
      '+ \tabcdefGhijkl\n',
      '? \t ^ ^  ^\n' ]
    */
    const lines = [];

    // Can hurt, but will probably help most of the time.
    let common = min(_countLeading(aline, '\t'),
                 _countLeading(bline, '\t'));
    common = min(common, _countLeading(atags.slice(0, common), ' '));
    common = min(common, _countLeading(btags.slice(0, common), ' '));
    atags = atags.slice(common).replace(/\s+$/, '');
    btags = btags.slice(common).replace(/\s+$/, '');

    lines.push('- ' + aline);
    if (atags.length) {
      lines.push(`? ${Array(common+1).join('\t')}${atags}\n`);
    }

    lines.push('+ ' + bline);
    if (btags.length) {
      lines.push(`? ${Array(common+1).join('\t')}${btags}\n`);
    }
    return lines;
  }
}

// With respect to junk, an earlier version of ndiff simply refused to
// *start* a match with a junk element.  The result was cases like this:
//     before: private Thread currentThread;
//     after:  private volatile Thread currentThread;
// If you consider whitespace to be junk, the longest contiguous match
// not starting with junk is "e Thread currentThread".  So ndiff reported
// that "e volatil" was inserted between the 't' and the 'e' in "private".
// While an accurate view, to people that's absurd.  The current version
// looks for matching blocks that are entirely junk-free, then extends the
// longest one of those as far as possible but only with matching junk.
// So now "currentThread" is matched, then extended to suck up the
// preceding blank; then "private" is matched, and extended to suck up the
// following blank; then "Thread" is matched; and finally ndiff reports
// that "volatile " was inserted before "Thread".  The only quibble
// remaining is that perhaps it was really the case that " volatile"
// was inserted after "private".  I can live with that <wink>.

const IS_LINE_JUNK = function(line, pat) {
  if (pat == null) { pat = /^\s*#?\s*$/; }
  /*
  Return 1 for ignorable line: iff `line` is blank or contains a single '#'.

  Examples:

  >>> IS_LINE_JUNK('\n')
  true
  >>> IS_LINE_JUNK('  #   \n')
  true
  >>> IS_LINE_JUNK('hello\n')
  false
  */

  return pat.test(line);
};

const IS_CHARACTER_JUNK = function(ch, ws) {
  if (ws == null) { ws = ' \t'; }
  /*
  Return 1 for ignorable character: iff `ch` is a space or tab.

  Examples:
  >>> IS_CHARACTER_JUNK(' ').should.be.true
  true
  >>> IS_CHARACTER_JUNK('\t').should.be.true
  true
  >>> IS_CHARACTER_JUNK('\n').should.be.false
  false
  >>> IS_CHARACTER_JUNK('x').should.be.false
  false
  */
  return Array.from(ws).includes(ch);
};


const _formatRangeUnified = function(start, stop) {
  /*
  Convert range to the "ed" format'
  */
  // Per the diff spec at http://www.unix.org/single_unix_specification/
  let beginning = start + 1; // lines start numbering with one
  const length = stop - start;
  if (length === 1) { return `${beginning}`; }
  if (!length) { beginning--; } // empty ranges begin at line just before the range
  return `${beginning},${length}`;
};

export const unifiedDiff = function(a, b, param) {
  if (param == null) { param = {}; }
  let {fromfile, tofile, fromfiledate, tofiledate, n, lineterm} = param;
  /*
  Compare two sequences of lines; generate the delta as a unified diff.

  Unified diffs are a compact way of showing line changes and a few
  lines of context.  The number of context lines is set by 'n' which
  defaults to three.

  By default, the diff control lines (those with ---, +++, or @@) are
  created with a trailing newline.

  For inputs that do not have trailing newlines, set the lineterm
  argument to "" so that the output will be uniformly newline free.

  The unidiff format normally has a header for filenames and modification
  times.  Any or all of these may be specified using strings for
  'fromfile', 'tofile', 'fromfiledate', and 'tofiledate'.
  The modification times are normally expressed in the ISO 8601 format.

  Example:

  >>> unifiedDiff('one two three four'.split(' '),
  ...             'zero one tree four'.split(' '), {
  ...               fromfile: 'Original'
  ...               tofile: 'Current',
  ...               fromfiledate: '2005-01-26 23:30:50',
  ...               tofiledate: '2010-04-02 10:20:52',
  ...               lineterm: ''
  ...             })
  [ '--- Original\t2005-01-26 23:30:50',
    '+++ Current\t2010-04-02 10:20:52',
    '@@ -1,4 +1,4 @@',
    '+zero',
    ' one',
    '-two',
    '-three',
    '+tree',
    ' four' ]

  */
  if (fromfile == null) {     fromfile = ''; }
  if (tofile == null) {       tofile = ''; }
  if (fromfiledate == null) { fromfiledate = ''; }
  if (tofiledate == null) {   tofiledate = ''; }
  if (n == null) {            n = 3; }
  if (lineterm == null) {     lineterm = '\n'; }

  const lines = [];
  let started = false;
  for (let group of Array.from((new SequenceMatcher(null, a, b)).getGroupedOpcodes())) {
    if (!started) {
      started = true;
      const fromdate = fromfiledate ? `\t${fromfiledate}` : '';
      const todate = tofiledate ? `\t${tofiledate}` : '';
      lines.push(`--- ${fromfile}${fromdate}${lineterm}`);
      lines.push(`+++ ${tofile}${todate}${lineterm}`);
    }

    const [first, last] = Array.from([group[0], group[group.length-1]]);
    const file1Range = _formatRangeUnified(first[1], last[2]);
    const file2Range = _formatRangeUnified(first[3], last[4]);
    lines.push(`@@ -${file1Range} +${file2Range} @@${lineterm}`);

    for (let [tag, i1, i2, j1, j2] of Array.from(group)) {
      var line;
      if (tag === 'equal') {
        for (line of Array.from(a.slice(i1, i2))) { lines.push(' ' + line); }
        continue;
      }
      if (['replace', 'delete'].includes(tag)) {
        for (line of Array.from(a.slice(i1, i2))) { lines.push('-' + line); }
      }
      if (['replace', 'insert'].includes(tag)) {
        for (line of Array.from(b.slice(j1, j2))) { lines.push('+' + line); }
      }
    }
  }

  return lines;
};

const _formatRangeContext = function(start, stop) {
  /*
  Convert range to the "ed" format'
  */
  // Per the diff spec at http://www.unix.org/single_unix_specification/
  let beginning = start + 1; // lines start numbering with one
  const length = stop - start;
  if (!length) { beginning--; } // empty ranges begin at line just before the range
  if (length <= 1) { return `${beginning}`; }
  return `${beginning},${(beginning + length) - 1}`;
};

// See http://www.unix.org/single_unix_specification/
export const contextDiff = function(a, b, param) {
  let tag, _;
  if (param == null) { param = {}; }
  let {fromfile, tofile, fromfiledate, tofiledate, n, lineterm} = param;
  /*
  Compare two sequences of lines; generate the delta as a context diff.

  Context diffs are a compact way of showing line changes and a few
  lines of context.  The number of context lines is set by 'n' which
  defaults to three.

  By default, the diff control lines (those with *** or ---) are
  created with a trailing newline.  This is helpful so that inputs
  created from file.readlines() result in diffs that are suitable for
  file.writelines() since both the inputs and outputs have trailing
  newlines.

  For inputs that do not have trailing newlines, set the lineterm
  argument to "" so that the output will be uniformly newline free.

  The context diff format normally has a header for filenames and
  modification times.  Any or all of these may be specified using
  strings for 'fromfile', 'tofile', 'fromfiledate', and 'tofiledate'.
  The modification times are normally expressed in the ISO 8601 format.
  If not specified, the strings default to blanks.

  Example:
  >>> a = ['one\n', 'two\n', 'three\n', 'four\n']
  >>> b = ['zero\n', 'one\n', 'tree\n', 'four\n']
  >>> contextDiff(a, b, {fromfile: 'Original', tofile: 'Current'})
  [ '*** Original\n',
    '--- Current\n',
    '***************\n',
    '*** 1,4 ****\n',
    '  one\n',
    '! two\n',
    '! three\n',
    '  four\n',
    '--- 1,4 ----\n',
    '+ zero\n',
    '  one\n',
    '! tree\n',
    '  four\n' ]
  */
  if (fromfile == null) {     fromfile = ''; }
  if (tofile == null) {       tofile = ''; }
  if (fromfiledate == null) { fromfiledate = ''; }
  if (tofiledate == null) {   tofiledate = ''; }
  if (n == null) {            n = 3; }
  if (lineterm == null) {     lineterm = '\n'; }

  const prefix = {
    insert  : '+ ',
    delete  : '- ',
    replace : '! ',
    equal   : '  '
  };
  let started = false;
  const lines = [];
  for (var group of Array.from((new SequenceMatcher(null, a, b)).getGroupedOpcodes())) {
    if (!started) {
      var line;
      started = true;
      const fromdate = fromfiledate ? `\t${fromfiledate}` : '';
      const todate = tofiledate ? `\t${tofiledate}` : '';
      lines.push(`*** ${fromfile}${fromdate}${lineterm}`);
      lines.push(`--- ${tofile}${todate}${lineterm}`);

      const [first, last] = Array.from([group[0], group[group.length-1]]);
      lines.push('***************' + lineterm);

      const file1Range = _formatRangeContext(first[1], last[2]);
      lines.push(`*** ${file1Range} ****${lineterm}`);

      if (_any((() => {
        const result = [];
        for ([tag, _, _, _, _] of Array.from(group)) {           result.push((['replace', 'delete'].includes(tag)));
        }
        return result;
      })())) {
        var i1, i2;
        for ([tag, i1, i2, _, _] of Array.from(group)) {
          if (tag !== 'insert') {
            for (line of Array.from(a.slice(i1, i2))) {
              lines.push(prefix[tag] + line);
            }
          }
        }
      }

      const file2Range = _formatRangeContext(first[3], last[4]);
      lines.push(`--- ${file2Range} ----${lineterm}`);

      if (_any((() => {
        const result1 = [];
        for ([tag, _, _, _, _] of Array.from(group)) {           result1.push((['replace', 'insert'].includes(tag)));
        }
        return result1;
      })())) {
        var j1, j2;
        for ([tag, _, _, j1, j2] of Array.from(group)) {
          if (tag !== 'delete') {
            for (line of Array.from(b.slice(j1, j2))) {
              lines.push(prefix[tag] + line);
            }
          }
        }
      }
    }
  }

  return lines;
};

export const ndiff = function(a, b, linejunk, charjunk) {
  if (charjunk == null) { charjunk = IS_CHARACTER_JUNK; }
  /*
  Compare `a` and `b` (lists of strings); return a `Differ`-style delta.

  Optional keyword parameters `linejunk` and `charjunk` are for filter
  functions (or None):

  - linejunk: A function that should accept a single string argument, and
    return true iff the string is junk.  The default is null, and is
    recommended;

  - charjunk: A function that should accept a string of length 1. The
    default is module-level function IS_CHARACTER_JUNK, which filters out
    whitespace characters (a blank or tab; note: bad idea to include newline
    in this!).

  Example:
  >>> a = ['one\n', 'two\n', 'three\n']
  >>> b = ['ore\n', 'tree\n', 'emu\n']
  >>> ndiff(a, b)
  [ '- one\n',
    '?  ^\n',
    '+ ore\n',
    '?  ^\n',
    '- two\n',
    '- three\n',
    '?  -\n',
    '+ tree\n',
    '+ emu\n' ]
  */
  return (new Differ(linejunk, charjunk)).compare(a, b);
};

export const restore = function(delta, which) {
  /*
  Generate one of the two sequences that generated a delta.

  Given a `delta` produced by `Differ.compare()` or `ndiff()`, extract
  lines originating from file 1 or 2 (parameter `which`), stripping off line
  prefixes.

  Examples:
  >>> a = ['one\n', 'two\n', 'three\n']
  >>> b = ['ore\n', 'tree\n', 'emu\n']
  >>> diff = ndiff(a, b)
  >>> restore(diff, 1)
  [ 'one\n',
    'two\n',
    'three\n' ]
  >>> restore(diff, 2)
  [ 'ore\n',
    'tree\n',
    'emu\n' ]
  */
  const tag = {1: '- ', 2: '+ '}[which];
  if (!tag) { throw new Error(`unknow delta choice (must be 1 or 2): ${which}`); }
  const prefixes = ['  ', tag];
  const lines = [];
  for (let line of Array.from(delta)) {
    var needle;
    if ((needle = line.slice(0, 2), Array.from(prefixes).includes(needle))) {
      lines.push(line.slice(2));
    }
  }
  return lines;
};



function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
};
