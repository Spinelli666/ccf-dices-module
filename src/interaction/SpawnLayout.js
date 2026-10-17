export class SpawnLayout {

	static COL_SPACING = 0.15;
	static ROW_SPACING = 0.22;
	static DIE_MARGIN = 0.10;

	static computeSpawnPosition(index, totalCount, location = "center", bounds = null) {
		if (totalCount <= 0 || index < 0) return { x: 0.5, y: 0.5 };

		if (location === "center" || !bounds) {
			return this._centerPosition(index, totalCount);
		}

		const corners = {
			topLeft:     { x: bounds.minX + this.DIE_MARGIN, y: bounds.maxY - this.DIE_MARGIN, dx:  1, dy: -1 },
			topRight:    { x: bounds.maxX - this.DIE_MARGIN, y: bounds.maxY - this.DIE_MARGIN, dx: -1, dy: -1 },
			bottomLeft:  { x: bounds.minX + this.DIE_MARGIN, y: bounds.minY + this.DIE_MARGIN, dx:  1, dy:  1 },
			bottomRight: { x: bounds.maxX - this.DIE_MARGIN, y: bounds.minY + this.DIE_MARGIN, dx: -1, dy:  1 }
		};

		const anchor = corners[location];
		if (!anchor) return this._centerPosition(index, totalCount);

		return this._trianglePosition(index, anchor);
	}

	static _trianglePosition(index, anchor) {
		let row = 0;
		while ((row + 1) * (row + 2) / 2 <= index) row++;
		const col = index - row * (row + 1) / 2;

		return {
			x: anchor.x + anchor.dx * this.COL_SPACING * col,
			y: anchor.y + anchor.dy * this.ROW_SPACING * (row - col)
		};
	}

	static _centerPosition(index, totalCount) {
		if (totalCount <= 0) return { x: 0.5, y: 0.5 };

		const cols = Math.ceil(Math.sqrt(totalCount));
		const rows = Math.ceil(totalCount / cols);

		const row = Math.floor(index / cols);
		const col = index % cols;

		return {
			x: 0.5 - (cols - 1) * this.COL_SPACING / 2 + col * this.COL_SPACING,
			y: 0.5 - (rows - 1) * this.ROW_SPACING / 2 + row * this.ROW_SPACING
		};
	}
}
