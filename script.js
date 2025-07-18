// -----------------
// 1. SETUP
// -----------------
const margin = { top: 40, right: 30, bottom: 60, left: 80 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3
  .select("#chart-area")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");
const legend = d3.select("#legend");

// -----------------
// 2. PARAMETERS & SCENE DEFINITIONS
// -----------------
let currentSceneIndex = 0;
let selectedYear = null;

const scenes = [
  {
    title: "The Content Explosion",
    narrative:
      "Netflix began as a DVD service, but its shift to streaming changed everything. This chart shows the total number of movies and TV shows added to the platform each year. Notice the dramatic acceleration after 2015.",
    annotation: {
      note: {
        label:
          "Content additions surged after 2015 as Netflix pushed heavily into original programming.",
        title: "The Great Acceleration",
        wrap: 200,
      },
      x: 650,
      y: 100,
      dx: -150,
      dy: 30,
    },
  },
  {
    title: "The Strategic Shift to Television",
    narrative:
      "The growth wasn't just quantity; it was a pivot to TV. <strong>Click any year's bar</strong> to see which countries produced the content for that specific year.",

    annotation: {
      note: {
        label:
          "By 2018, TV show additions nearly equaled movies, highlighting the new focus on binge-able series.",
        title: "Pivoting to Series",
        wrap: 200,
      },
      x: 720,
      y: 150,
      dx: -250,
      dy: 20,
    },
  },
  {
    // ✅ Updated title and narrative for Scene 3 using a placeholder
    title: "Top Countries in __YEAR__",
    narrative:
      "This chart shows the top content-producing countries (excluding the US) for content released in __YEAR__. You can hover over a bar to see the exact count.",
    annotation: null,
  },
];

// -----------------
// 3. D3 LOGIC
// -----------------
d3.csv("netflix_titles.csv")
  .then((data) => {
    // --- Data Processing ---
    data.forEach((d) => {
      d.release_year = +d.release_year;
    });

    // Filter for relevant years (e.g., after 2000)
    const filteredData = data.filter(
      (d) => d.release_year > 2000 && d.release_year < 2022
    );

    // Data for Scene 1 & 2: Content added per year
    const yearlyCounts = d3.rollup(
      filteredData,
      (v) => v.length,
      (d) => d.release_year
    );
    const yearlyData = Array.from(yearlyCounts, ([year, count]) => ({
      year,
      count,
    })).sort((a, b) => a.year - b.year);

    // Data for Scene 2: Stacked bar chart
    const yearlyCountsByType = d3.rollup(
      filteredData,
      (v) => ({
        Movie: v.filter((d) => d.type === "Movie").length,
        "TV Show": v.filter((d) => d.type === "TV Show").length,
      }),
      (d) => d.release_year
    );

    const stackedData = Array.from(yearlyCountsByType, ([year, counts]) => ({
      year,
      ...counts,
    })).sort((a, b) => a.year - b.year);
    const stack = d3.stack().keys(["Movie", "TV Show"]);
    const series = stack(stackedData);

    // Data for Scene 3: Top countries
    const countryCounts = d3.rollup(
      filteredData,
      (v) => v.length,
      (d) => d.country.split(",")[0].trim()
    );
    countryCounts.delete("United States"); // Remove US to see other leaders
    countryCounts.delete(""); // Remove blank entries
    const topCountries = Array.from(countryCounts, ([country, count]) => ({
      country,
      count,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    d3.select("#all-time-toggle").on("change", () => {
      drawScene(currentSceneIndex); // Redraw the scene when the toggle changes
    });
    // --- Main Drawing Function ---
    function drawScene(sceneIndex) {
      tooltip.style("opacity", 0);
      const scene = scenes[sceneIndex];

      // Update text
      d3.select("#scene-title").text(scene.title);
      d3.select("#scene-narrative").html(scene.narrative);

      // Clear previous SVG contents
      svg.selectAll("*").remove();
      legend.html(""); // Clear legend

      // --- SCENE-SPECIFIC RENDERING ---
      if (sceneIndex === 0) {
        // Scene 1: Bar chart of total content
        const xScale = d3
          .scaleBand()
          .domain(yearlyData.map((d) => d.year))
          .range([0, width])
          .padding(0.2);
        const yScale = d3
          .scaleLinear()
          .domain([0, d3.max(yearlyData, (d) => d.count)])
          .range([height, 0]);

        svg
          .append("g")
          .attr("transform", `translate(0, ${height})`)
          .call(d3.axisBottom(xScale))
          .selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end");
        svg.append("g").call(d3.axisLeft(yScale));

        svg
          .selectAll("rect")
          .data(yearlyData)
          .join("rect")
          .attr("x", (d) => xScale(d.year))
          .attr("y", (d) => yScale(d.count))
          .attr("width", xScale.bandwidth())
          .attr("height", (d) => height - yScale(d.count))
          .attr("fill", "#E50914")
          // ✅ ADD THIS TOOLTIP LOGIC
          .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip
              .html(
                `<strong>Year:</strong> ${d.year}<br/>
                          <strong>Titles Added:</strong> ${d.count}`
              )
              .style("left", event.pageX + 15 + "px")
              .style("top", event.pageY - 28 + "px");
          })
          .on("mouseout", () => {
            tooltip.transition().duration(500).style("opacity", 0);
          });
      } else if (sceneIndex === 1) {
        // Scene 2: Stacked bar chart
        // ... (scales and color definitions are the same) ...
        const xScale = d3
          .scaleBand()
          .domain(stackedData.map((d) => d.year))
          .range([0, width])
          .padding(0.2);
        const yScale = d3
          .scaleLinear()
          .domain([0, d3.max(yearlyData, (d) => d.count)])
          .nice()
          .range([height, 0]);
        const color = d3
          .scaleOrdinal()
          .domain(["Movie", "TV Show"])
          .range(["#B20710", "#f5f5f1"]);

        const barGroups = svg
          .append("g")
          .selectAll("g")
          .data(series)
          .join("g")
          .attr("fill", (d) => color(d.key))
          .attr("class", (d) => `series-${d.key.replace(" ", "-")}`);

        barGroups
          .selectAll("rect")
          .data((d) => d)
          .join("rect")
          .attr("x", (d) => xScale(d.data.year))
          .attr("y", (d) => yScale(d[1]))
          .attr("height", (d) => yScale(d[0]) - yScale(d[1]))
          .attr("width", xScale.bandwidth())
          .style("cursor", "pointer")
          .on("click", (event, d) => {
            selectedYear = d.data.year; // Store the clicked year
            currentSceneIndex++; // Move to the next scene
            drawScene(currentSceneIndex); // Redraw
          })
          // ✅ ADD THIS TOOLTIP LOGIC
          .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip
              .html(
                `<strong>Year:</strong> ${d.data.year}<br/>
                          <strong>Movie Count:</strong> ${d.data.Movie}<br/>
                          <strong>TV Count:</strong> ${d.data["TV Show"]}`
              ) // Use bracket notation for "TV Show"
              .style("left", event.pageX + 15 + "px")
              .style("top", event.pageY - 28 + "px");
          })
          .on("mouseout", () => {
            tooltip.transition().duration(500).style("opacity", 0);
          });

        // ... (axes and legend code is the same) ...
        svg
          .append("g")
          .attr("transform", `translate(0, ${height})`)
          .call(d3.axisBottom(xScale))
          .selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end");
        svg.append("g").call(d3.axisLeft(yScale));
        const legendItems = legend
          .selectAll(".legend-item")
          .data(color.domain());
        const legendEnter = legendItems
          .enter()
          .append("div")
          .attr("class", "legend-item");
        legendEnter
          .append("div")
          .attr("class", "legend-color")
          .style("background-color", color);
        legendEnter.append("span").text((d) => d);
      } else if (sceneIndex === 2) {
        // Scene 3: Horizontal bar chart of countries
        // ✅ Dynamically update the title and narrative
        d3.select("#scene-title").text(
          scene.title.replace("__YEAR__", selectedYear)
        );
        d3.select("#scene-narrative").html(
          scene.narrative.replace("__YEAR__", selectedYear)
        );

        // ✅ Filter the main dataset for only the selected year
        const yearFilteredData = filteredData.filter(
          (d) => d.release_year === selectedYear
        );

        // ✅ Re-calculate top countries using only the year-filtered data
        const countryCounts = d3.rollup(
          yearFilteredData,
          (v) => v.length,
          (d) => (d.country ? d.country.split(",")[0].trim() : "")
        );
        countryCounts.delete("United States");
        countryCounts.delete("");
        const topCountries = Array.from(countryCounts, ([country, count]) => ({
          country,
          count,
        }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Draw the chart with the new, specific data
        const xScale = d3
          .scaleLinear()
          .domain([0, d3.max(topCountries, (d) => d.count) || 1])
          .range([0, width]);
        const yScale = d3
          .scaleBand()
          .domain(topCountries.map((d) => d.country))
          .range([0, height])
          .padding(0.1);

        svg
          .append("g")
          .attr("transform", `translate(0, ${height})`)
          .call(d3.axisBottom(xScale));
        svg.append("g").call(d3.axisLeft(yScale));

        svg
          .selectAll("rect")
          .data(topCountries)
          .join("rect")
          // ... (drawing and tooltip logic is the same) ...
          .attr("x", 0)
          .attr("y", (d) => yScale(d.country))
          .attr("width", (d) => xScale(d.count))
          .attr("height", yScale.bandwidth())
          .attr("fill", "#E50914")
          .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip
              .html(`<strong>${d.country}</strong><br/>Titles: ${d.count}`) // This line shows the count
              .style("left", event.pageX + 15 + "px")
              .style("top", event.pageY - 28 + "px");
          });
      }

      // Add annotations if they exist for the scene
      if (scene.annotation) {
        const makeAnnotations = d3.annotation().annotations([scene.annotation]);
        svg.append("g").attr("class", "annotation-group").call(makeAnnotations);
      }

      updateButtons();
    }

    // -----------------
    // 4. TRIGGERS & INITIALIZATION
    // -----------------
    function updateButtons() {
      d3.select("#prev-button").property("disabled", currentSceneIndex === 0);

      // ✅ Hide "Next" button on Scene 2 (index 1) and the last scene
      const hideNextButton =
        currentSceneIndex === 1 || currentSceneIndex === scenes.length - 1;
      d3.select("#next-button").style(
        "display",
        hideNextButton ? "none" : "inline-block"
      );
    }

    // Event Listeners for TRIGGERS
    d3.select("#next-button").on("click", () => {
      if (currentSceneIndex < scenes.length - 1) {
        currentSceneIndex++;
        drawScene(currentSceneIndex);
      }
    });

    d3.select("#prev-button").on("click", () => {
      if (currentSceneIndex > 0) {
        currentSceneIndex--;
        drawScene(currentSceneIndex);
      }
    });

    // Initial draw
    drawScene(currentSceneIndex);
  })
  .catch((error) => {
    console.error("Error loading the CSV file:", error);
  });
