import React from 'react'
import Link from 'next/link'

import './barchart.scss'

const BarChart = ({ data, max, title, category }) => {
  const calcPercentage = (absolute, dings) => {
    if (dings >= 0) {
      const percentage = Math.round((absolute * 100) / dings)
      return percentage
    }
  }

  const createLink = (element) => {
    if (element[2]) {
      return (
        <Link href={`/${category}/${element[2]}`}>
          <strong>{element[1]}</strong> {element[0]}
        </Link>
      )
    }
    return (
      <>
        <strong>{element[1]}</strong> {element[0]}
      </>
    )
  }

  return (
    <div className="barchart">
      <h4 title={title}>{category}</h4>
      <ul>
        {data?.map((element) => {
          return (
            <li key={element[0]} title={element[0]}>
              <span
                className="bar"
                style={{ width: calcPercentage(element[1], max) + '%' }}
              >
                &nbsp;
              </span>
              <span className="text">{createLink(element)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default BarChart
