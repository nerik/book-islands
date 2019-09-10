# Layout

## Generate clusters

Generate cluster of islands using one of the methods <a href="https://towardsdatascience.com/the-5-clustering-algorithms-data-scientists-need-to-know-a36d136ef68">described here</a>.

DBScan seems to be a good fit (respects "shape" better). Been trying with Supercluster for now which is simpler and faster.

Optional rules:
- break clusters apart arbitrarily the less significant the authors are? (ie generate Pacific Island nations type)

## Custom clusterization step

Might be interesting to add a step that generate some randomness in the clusters, ie group arbitrarily clusters that are close. 
Or force some cluster to have non square/circle shapes by "walking" through some network (TIN/<a href="https://observablehq.com/@d3/delaunay-find?collection=@d3/d3-delaunay">delaunay</a>) and force a limited angle when jumping to the next point.

## Cluster - Base Island fit

For each cluster, loop through all base islands and apply a transformation to the island until all cluster points lie within polygon. Transformation includes scaling down and mirroring both ways. Rotation should be avoided if possible. Scaling up can't be done.

If transformation is possible, give a base fit score depending on:
- how little empty space there is comparing cluster point envelope area vs island area
- whether there are sufficient cities in the island
- whether most cities are real rather than procedural

## Global layout

Loop through all clusters starting with the biggest (the one with the most points). Pick the base island that
- has the best fit score
- AND is not the same base island as an neighbor island within x radius.


## Overlap handling

It is assumed that some overlap will happen. 
- if not too much overlap (turf.intersect, compute area agains threshold), leave it as is. 
- if too much overlap, this could create problems with the height maps. In that case force reduction/translate of smallest/least significant island.

## Inner island layout

- Generate (delaunay?) network including island polygon vertices + island cities
  - might be necessary to create noise inside island to generate more verices
- For each author (start with most significant), pick position, find closest island city. This is the "capital". Do the same for all authors by order of significance (match with city size if possible, to a certain extent).
- For each territory/author, pick the next closest city/book, repeat until books exhausted. "Next" could mean simple distance or shortest path within network (probably better as it won't "cross water")
- Generate frontiers: Not sure??? 
  Walk network polygons from each territory city. Take neighbour. Ignore neighbour if already belonging to city and pick other. If other territory polygon is met from an edge, mark this edge as a frontier segment. When done group frontier segments.
  Read: https://github.com/nerik/book-islands/blob/master/layout-strategy.md

  Use grid with diagonals instead of delaunay? Neighbour resolution would be much simpler.

  Add a bit of disbalance for more important author/territories, so that they have a better chance to "conquer" a polygon/grid bit.

  Favor direction of other cities when walking to avoid isolated territory bits. 


## Generate labels points positions

Generate envelope for each author territory/ find center of mass.
Better: generate a line for the label to placed along.




# Base islands prep

## Include islets

- Generate center of mass for each island (no lower size threshold)
- Separate dataset into islands and islets (use lower size threshold)
- For each island center of mass: pick all islets within x radius
- For each of the island polygon points (or every 10 points), check distance with islet center within radius. If lower than y radius, attach islet to island.


## Generate procedural cities

- Simplest possible option: only coastal cities. Pick random island polygon points (must not be too close to other real or procedural city).