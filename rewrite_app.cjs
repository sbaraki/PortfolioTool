const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');

// The section we want to replace starts at line 1152.
const startMarker = '<div className="flex-1 flex overflow-hidden timeline-root no-print-bg px-3 pb-3 pt-2 gap-3 print:overflow-visible">';

// We know the end marker is around line 2050
const endMarker = '</main>\n          </div>\n            </div>';

if (!code.includes(startMarker)) {
  console.log("Start marker not found");
  process.exit(1);
}

const beforeBlock = code.substring(0, code.indexOf(startMarker));
const afterBlock = code.substring(code.indexOf('</main>\n          </div>\n            </div>') + '</main>\n          </div>\n            </div>'.length);

let newStructure = `
              <div 
                tabIndex={0}
                data-print-timeline
                className={\`flex-1 overflow-auto timeline-container custom-scrollbar relative bg-slate-50/50 flex \${isDraggingScroll || draggingMilestone ? '!cursor-grabbing' : ''}\`}
                ref={timelineRef}
                onMouseDown={(e) => {
                  if (e.button === 0 && !longPressTimerRef.current && !draggingBarId && !draggingMilestone) {
                    setIsDraggingScroll(true);
                    startXRef.current = e.pageX - timelineRef.current!.offsetLeft;
                    scrollLeftRef.current = timelineRef.current!.scrollLeft;
                  }
                }}
                onMouseUp={() => {
                  setIsDraggingScroll(false);
                  if (draggingBarId && dragTempStartDate && dragTempEndDate) {
                    const ex = exhibitions.find(e => e.id === draggingBarId);
                    if (ex) {
                      handleUpdateExhibition({
                        ...ex,
                        startDate: dragTempStartDate,
                        endDate: dragTempEndDate
                      });
                    }
                  }
                  if (resizingEdge) commitResize();
                  if (resizingPhase) commitPhaseResize();
                  if (draggingMilestone) commitMilestoneDrag();
                  setDraggingBarId(null);
                  setDragTempStartDate(null);
                  setDragTempEndDate(null);
                  clearLongPress();
                }}
                onMouseLeave={() => {
                  setIsDraggingScroll(false);
                  if (draggingBarId && dragTempStartDate && dragTempEndDate) {
                    const ex = exhibitions.find(e => e.id === draggingBarId);
                    if (ex) {
                      handleUpdateExhibition({
                        ...ex,
                        startDate: dragTempStartDate,
                        endDate: dragTempEndDate
                      });
                    }
                  }
                  if (resizingEdge) commitResize();
                  if (resizingPhase) commitPhaseResize();
                  if (draggingMilestone) commitMilestoneDrag();
                  setDraggingBarId(null);
                  setDragTempStartDate(null);
                  setDragTempEndDate(null);
                  clearLongPress();
                }}
                onMouseMove={(e) => {
                  clearLongPress();

                  if (draggingMilestone) {
                    const deltaX = e.clientX - draggingMilestone.initialMouseX;
                    if (Math.abs(deltaX) > 2) suppressMilestoneClickRef.current = true;
                    // Adjusted for shared scrolling layout
                    const offsetMap = timelineRef.current ? timelineRef.current.scrollLeft : 0;
                    const initialX = getPositionFromDate(draggingMilestone.initialDate, monthWidth, viewMonths);
                    let newDate = getDateFromPosition(initialX + deltaX, monthWidth, viewMonths);
                    if (showWeeklyGrid && !e.altKey) newDate = snapDate(newDate, 'week');
                    setDraggingMilestone(prev => prev ? { ...prev, tempDate: newDate } : prev);
                    return;
                  }

                  if (resizingEdge) {
                    const deltaX = e.clientX - resizeInitialMouseXRef.current;
                    const dayPxRatio = (365.25 / 12) / monthWidth; // days per pixel
                    const deltaDays = Math.round(deltaX * dayPxRatio);
                    if (resizingEdge.edge === 'left') {
                      const initStart = new Date(resizeInitialStartDateRef.current + 'T12:00:00');
                      const initEnd = new Date(resizeInitialEndDateRef.current + 'T12:00:00');
                      const newStart = new Date(initStart);
                      newStart.setDate(newStart.getDate() + deltaDays);
                      // Don't allow start to cross end (keep at least 1 day duration).
                      const minEnd = new Date(initEnd);
                      minEnd.setDate(minEnd.getDate() - 1);
                      if (newStart > minEnd) return;
                      let iso = toISODate(newStart);
                      if (showWeeklyGrid && !e.altKey) iso = snapDate(iso, 'week');
                      setDragTempStartDate(iso);
                      setDragTempEndDate(resizeInitialEndDateRef.current);
                    } else {
                      const initStart = new Date(resizeInitialStartDateRef.current + 'T12:00:00');
                      const initEnd = new Date(resizeInitialEndDateRef.current + 'T12:00:00');
                      const newEnd = new Date(initEnd);
                      newEnd.setDate(newEnd.getDate() + deltaDays);
                      const minStart = new Date(initStart);
                      minStart.setDate(minStart.getDate() + 1);
                      if (newEnd < minStart) return;
                      let iso = toISODate(newEnd);
                      if (showWeeklyGrid && !e.altKey) iso = snapDate(iso, 'week');
                      setDragTempStartDate(resizeInitialStartDateRef.current);
                      setDragTempEndDate(iso);
                    }
                    return;
                  }

                  if (resizingPhase) {
                    const deltaX = e.clientX - phaseResizeInitialMouseXRef.current;
                    const deltaMonths = deltaX / monthWidth;
                    // Snap to quarter-month (~weekly) granularity.
                    const raw = phaseResizeInitialDurationRef.current + deltaMonths;
                    const snapped = Math.max(0.25, Math.round(raw * 4) / 4);
                    setPhaseResizeTempDuration(snapped);
                    return;
                  }

                  if (draggingBarId) {
                    const deltaX = e.clientX - dragStartMouseXRef.current;
                    const newProjectX = dragStartProjectXRef.current + deltaX;
                    let newStartDate = getDateFromPosition(newProjectX, monthWidth, viewMonths);
                    if (showWeeklyGrid && !e.altKey) newStartDate = snapDate(newStartDate, 'week');
                    const start = new Date(newStartDate + 'T12:00:00');
                    const draggedEnd = new Date(start);
                    draggedEnd.setDate(draggedEnd.getDate() + dragDurationDaysRef.current);
                    const newEndDate = toISODate(draggedEnd);

                    setDragTempStartDate(newStartDate);
                    setDragTempEndDate(newEndDate);
                    return;
                  }

                  if (!isDraggingScroll || !timelineRef.current) return;
                  const x = e.pageX - timelineRef.current.offsetLeft;
                  timelineRef.current.scrollLeft = scrollLeftRef.current - (x - startXRef.current) * 1.5;
                }}
              >
                <div className="inline-flex flex-col relative min-w-max min-h-max bg-white shadow-sm border border-slate-200 mx-3 my-2 print:m-0 print:border-none print:shadow-none">
                  
                  {/* GLOBAL HEADER ROW */}
                  <div className="sticky top-0 z-[60] flex border-b border-slate-200 bg-white" style={{ height: \`\${HEADER_HEIGHT}px\` }}>
                    {/* Top-Left Corner Sidebar Header */}
                    <div 
                      className="sticky left-0 z-[70] bg-slate-50/50 border-r border-slate-200 flex flex-col justify-center px-3 shrink-0 print:bg-white shadow-[2px_0_4px_rgba(0,0,0,0.02)]"
                      style={{ width: \`\${SIDEBAR_WIDTH}px\` }}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide leading-none">Galleries</span>
                        <span className="text-[11px] font-semibold text-slate-700 leading-none mt-1">
                          <span className="font-mono text-slate-500">{portfolioGalleries.length}</span>
                          <span className="text-slate-300 mx-1">·</span>
                          <span className="font-mono text-slate-500">{filteredExhibitions.length}</span>
                          {' '}project{filteredExhibitions.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Timeline Headers */}
                    <div className="relative flex flex-col bg-white overflow-hidden">
                      <div className="flex h-[22px] border-b border-slate-200 bg-white relative z-10 print:bg-white print:border-slate-400">
                        {yearBlocks.map(block => <div key={block.label} style={{ width: \`\${monthWidth * block.count}px\` }} className="shrink-0 h-full flex items-center px-3 font-semibold text-[11px] tracking-[0.06em] text-slate-900 border-r border-slate-200 print:border-slate-400 print:text-black">{block.label}</div>)}
                      </div>
                       <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/60 relative z-10 print:bg-orange-50 print:border-orange-300">
                         {fyBlocks.map((block) => (
                           <div key={block.label} style={{ width: \`\${monthWidth * block.count}px\` }} className="shrink-0 h-full flex items-center justify-start px-3 font-semibold text-[9px] uppercase tracking-[0.08em] border-r border-slate-200 text-slate-600 print:text-orange-900">{block.label}</div>
                         ))}
                       </div>
                      <div className="flex h-[16px] border-b border-slate-200 bg-slate-50/40 relative z-10 print:bg-slate-50 text-slate-600">
                        {fyQuarterBlocks.map((block, i) => <div key={\`\${block.label}-\${i}\`} style={{ width: \`\${monthWidth * block.count}px\` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[9px] font-medium tracking-[0.06em] text-slate-500 print:text-slate-900">{block.label}</div>)}
                      </div>
                      <div className="flex h-[16px] bg-white relative z-10 print:bg-white text-slate-500">
                        {viewMonths.map(m => <div key={\`\${m.year}-\${m.month}\`} style={{ width: \`\${monthWidth}px\` }} className="shrink-0 h-full flex items-center justify-center border-r border-slate-200 text-[9px] font-medium tracking-[0.04em] print:text-slate-900">{m.label}</div>)}
                      </div>
                    </div>
                  </div>

                  {/* GLOBAL BODY CONTAINER */}
                  <div className="relative flex min-h-[500px]">
                    {/* Background Layer: Grid Lines, Feedbacks */}
                    <div 
                      className="absolute top-0 bottom-0 pointer-events-none z-[10] overflow-hidden" 
                      style={{ left: \`\${SIDEBAR_WIDTH}px\`, width: \`\${totalTimelineWidth}px\` }}
                    >
                      {/* Now Indicator */}
                      <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[70] pointer-events-none" style={{ left: \`\${todayPos}px\` }}>
                        <div className="sticky top-[6px] bg-red-600 text-white font-semibold text-[10px] px-1.5 py-0.5 uppercase transform -translate-x-1/2 shadow-sm w-max whitespace-nowrap">TODAY</div>
                      </div>

                      {/* Drag Feedbacks... */}
                      {/* Replace inner dragging feedbacks with those from previous code but kept local */}
                      <!-- DRAG_FEEDBACK_PLACEHOLDER -->

                      {/* Grid Lines */}
                      {showWeeklyGrid && weeklyPositions.map((pos, idx) => (
                        <div
                          key={\`week-\${idx}\`}
                          style={{ left: \`\${pos}px\` }}
                          className="absolute top-0 bottom-0 w-[1px] border-l border-dotted border-slate-300/40 print:border-slate-200"
                        />
                      ))}
                      {viewMonths.map((m, idx) => {
                        if (idx === 0) return null;
                        const style = { left: \`\${idx * monthWidth}px\` };
                        return (
                          <div 
                            key={\`month-divider-\${idx}\`} 
                            style={style} 
                            className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-black/5 print:border-slate-200"
                          />
                        );
                      })}
                      {(() => {
                        let currentOffset = 0;
                        return fyBlocks.map((block, idx) => {
                          const style = { left: \`\${currentOffset}px\` };
                          currentOffset += block.count * monthWidth;
                          if (idx === 0 && style.left === '0px') return null;
                          return (
                            <div 
                              key={\`fy-line-\${idx}\`} 
                              style={style} 
                              className="absolute top-0 bottom-0 w-0 border-l-[1.5px] border-dashed border-slate-400 z-10 opacity-60 print:opacity-100 print:border-slate-500"
                            />
                          );
                        });
                      })()}
                    </div>

                    {/* Mapped Rows */}
                    <div className="flex flex-col flex-1 z-20">
                      {filteredExhibitions.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center p-20 pointer-events-none z-[40]">
                          <div className="max-w-md bg-white/90 border border-slate-200 px-8 py-10 shadow-[0_18px_40px_rgba(15,23,42,0.08)] text-center">
                            <Search size={40} className="mx-auto mb-4 text-slate-300" />
                            <p className="text-xl font-semibold uppercase tracking-[0.18em] text-slate-700">No Projects Found</p>
                          </div>
                        </div>
                      )}

                      {portfolioGalleries.map((gallery) => {
                        const g = gallery.name;
                        const laneHeight = galleryLaneHeights[g] || BASE_LANE_HEIGHT;
                        const galleryProjects = filteredExhibitions.filter(ex => ex.gallery === g);
                        const isCollapsed = effectiveCollapsedGalleryIds.has(gallery.id);
                        const isPermanent = gallery.kind === 'permanent';
                        const headerStripHeight = mhFor(g);

                        if (isCollapsed) {
                          return (
                            <div key={gallery.id} style={{ height: \`\${laneHeight}px\` }} className="flex border-b-2 border-slate-300 relative group">
                              <div className={\`sticky left-0 z-[50] flex items-center pl-4 pr-2.5 gap-1.5 shrink-0 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.01)] \${isPermanent ? 'bg-amber-50/70' : 'bg-slate-50'} print:bg-white\`} style={{ width: \`\${SIDEBAR_WIDTH}px\` }}>
                                <div className={\`absolute left-0 top-0 bottom-0 w-[3px] \${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}\`} />
                                <button type="button" aria-label={\`Expand \${gallery.name}\`} onClick={() => toggleGalleryCollapsed(gallery.id)} className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors no-print">
                                  <ChevronRight size={12} strokeWidth={2.25} />
                                </button>
                                <span className="font-bold text-[13px] text-slate-900 truncate flex-1 uppercase tracking-[0.04em]" title={gallery.name}>{gallery.name}</span>
                                {isPermanent && <Star size={11} className="shrink-0 text-amber-600 fill-amber-600" strokeWidth={1.5} />}
                                <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500 px-1.5 py-0.5 bg-white border border-slate-200">{galleryProjects.length}</span>
                              </div>
                              <div className="flex-1 relative overflow-hidden bg-slate-50/80 bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.06)_0px,rgba(148,163,184,0.06)_4px,transparent_4px,transparent_8px)] print:bg-slate-100 print:bg-none" style={{ width: \`\${totalTimelineWidth}px\` }}>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={gallery.id} style={{ height: \`\${laneHeight}px\` }} className="flex border-b-2 border-slate-300 relative group bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.95)_100%)] print:bg-none print:bg-white">
                            {/* SIDEBAR CELL */}
                            <div className={\`sticky left-0 z-[50] shrink-0 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.01)] \${isPermanent ? 'bg-amber-50/40' : 'bg-white'} print:bg-white\`} style={{ width: \`\${SIDEBAR_WIDTH}px\` }}>
                              <div className={\`absolute left-0 top-0 bottom-0 w-[3px] z-10 \${isPermanent ? 'bg-amber-600' : 'bg-slate-500'}\`} />
                              
                              <div style={{ height: \`\${headerStripHeight}px\` }} className={\`w-full border-b border-slate-300 flex items-center gap-1.5 pl-4 pr-2.5 z-20 absolute top-0 \${isPermanent ? 'bg-amber-50' : 'bg-slate-50'} print:bg-white\`}>
                                <button type="button" aria-label={\`Collapse \${gallery.name}\`} onClick={() => toggleGalleryCollapsed(gallery.id)} className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors no-print">
                                  <ChevronDown size={12} strokeWidth={2.25} />
                                </button>
                                <span className="font-bold text-[13px] text-slate-900 truncate flex-1 uppercase tracking-[0.04em]" title={gallery.name}>{gallery.name}</span>
                                {isPermanent && <Star size={11} className="shrink-0 text-amber-600 fill-amber-600" strokeWidth={1.5} />}
                                <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500 px-1.5 py-0.5 bg-white border border-slate-200">{galleryProjects.length}</span>
                              </div>

                              {galleryProjects.map(ex => {
                                const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                                if (trackIndex === undefined) return null;
                                const layout = galleryTrackLayouts[gallery.name];
                                const trackTop = layout?.trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                                const lastTrackIdx = getProjectLastAllocatedTrackIndex(ex, trackIndex, Math.max(1, layout?.trackTops.length ?? 0));
                                const lastTrackTop = layout?.trackTops[lastTrackIdx] ?? trackTop;
                                const topPos = headerStripHeight + LANE_TOP_PADDING + lastTrackTop;
                                const titleBandTop = topPos + (TRACK_HEIGHT - STANDARD_BAR_HEIGHT) / 2;
                                return (
                                  <div key={\`title-\${ex.id}\`} className="absolute flex items-center gap-1.5 overflow-hidden z-20" style={{ top: titleBandTop, height: \`\${STANDARD_BAR_HEIGHT}px\`, left: '12px', right: '10px' }}>
                                    <span className="text-[12px] font-medium text-slate-900 truncate leading-tight min-w-0" title={ex.title}>{ex.title}</span>
                                    {ex.exhibitionId && <span className="shrink-0 text-[9px] font-mono text-slate-400 leading-none whitespace-nowrap" title={ex.exhibitionId}>{ex.exhibitionId}</span>}
                                  </div>
                                );
                              })}
                              {galleryProjects.map(ex => {
                                const trackIndex = galleryLayouts[gallery.name]!.tracks[ex.id];
                                if (trackIndex === undefined || trackIndex === 0) return null;
                                const trackTop = galleryTrackLayouts[gallery.name]?.trackTops[trackIndex] ?? trackIndex * TRACK_HEIGHT;
                                return (
                                  <div key={\`side-div-\${ex.id}\`} className="absolute w-full border-t border-slate-100 left-0 z-10" style={{ top: headerStripHeight + LANE_TOP_PADDING + trackTop }} />
                                );
                              })}
                            </div>

                            {/* TIMELINE CELL */}
                            <div className="relative flex-1" style={{ width: \`\${totalTimelineWidth}px\` }}>
                              <div className={\`absolute top-0 left-0 right-0 border-b border-slate-300 pointer-events-none z-10 \${isPermanent ? 'bg-amber-50/60' : 'bg-slate-50/80'} print:bg-white\`} style={{ height: \`\${headerStripHeight}px\` }} />
                              <!-- TIMELINE_CELL_CONTENT -->
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
`;

// Now let's extract the drag feedback
const oldCodeBlock = code.substr(code.indexOf(startMarker), code.indexOf(endMarker) - code.indexOf(startMarker));

let dragFeedbackCode = '';
const dragIndex = oldCodeBlock.indexOf('{activeMilestoneDragFeedback && (');
if (dragIndex > -1) {
  dragFeedbackCode = oldCodeBlock.substring(dragIndex, oldCodeBlock.indexOf('{/* Header */}'));
}
newStructure = newStructure.replace('<!-- DRAG_FEEDBACK_PLACEHOLDER -->', dragFeedbackCode);

let timelineCellContentCode = '';
const timelineIndex = oldCodeBlock.indexOf('{(() => {\n                                const gMilestones = packMilestoneLabels<LocationMilestone & { xPos: number }>(');
if (timelineIndex > -1) {
  // Try to find the end of the timeline loop for a gallery
  // It ends gracefully. We can scrape it.
  const timelineStop = oldCodeBlock.indexOf('</div>\n                           </div>\n                         );\n                      })}');
  timelineCellContentCode = oldCodeBlock.substring(timelineIndex, timelineStop);
  
} else {
  console.log("Could not find timeline logic chunk.");
}

newStructure = newStructure.replace('<!-- TIMELINE_CELL_CONTENT -->', timelineCellContentCode);

fs.writeFileSync('src/App.tsx', beforeBlock + newStructure + afterBlock);
console.log("Rewrite completed successfully!");
